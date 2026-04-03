import { NextResponse } from "next/server";
import { GetCostAndUsageCommand, GetCostAndUsageCommandOutput } from "@aws-sdk/client-cost-explorer";
import { getCostExplorerClient } from "@/lib/aws-clients";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    // today at UTC midnight (exclusive end for Cost Explorer)
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const monthParam = searchParams.get("month"); // e.g. "2026-04"

    let start: string;
    let end: string;

    if (monthParam) {
      const [yr, mo] = monthParam.split("-").map(Number);
      const s = new Date(Date.UTC(yr, mo - 1, 1));
      const e = new Date(Date.UTC(yr, mo, 1)); // first of next month
      start = s.toISOString().slice(0, 10);
      // Cap end at today (CE only has completed days through yesterday)
      end = e <= todayUTC ? e.toISOString().slice(0, 10) : todayUTC.toISOString().slice(0, 10);
    } else {
      // Default: from 1st of previous month through today
      const prevMonthFirst = new Date(
        Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 1, 1)
      );
      start = searchParams.get("start") || prevMonthFirst.toISOString().slice(0, 10);
      end = searchParams.get("end") || todayUTC.toISOString().slice(0, 10);
    }

    // Safety: AWS CE throws if start === end; ensure end is at least start+1
    if (start >= end) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() + 1);
      end = d.toISOString().slice(0, 10);
    }

    // Current month boundaries (for the pinned MTD card)
    const currentMonthStart = new Date(
      Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)
    ).toISOString().slice(0, 10);
    const currentMonthEnd = todayUTC.toISOString().slice(0, 10);
    const needSeparateMtd = start > currentMonthStart; // main range doesn't include current month start

    const ce = getCostExplorerClient();

    // ── Parallel fetches ────────────────────────────────────────────────
    const promises: Promise<GetCostAndUsageCommandOutput>[] = [
      ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
      })),
      ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      })),
    ];

    // Only fetch MTD separately when the main range doesn't cover the current month
    if (needSeparateMtd && currentMonthEnd > currentMonthStart) {
      promises.push(
        ce.send(new GetCostAndUsageCommand({
          TimePeriod: { Start: currentMonthStart, End: currentMonthEnd },
          Granularity: "DAILY",
          Metrics: ["UnblendedCost"],
        }))
      );
    }

    const results = await Promise.all(promises);
    const overallRes = results[0];
    const serviceRes = results[1];
    const mtdRes = results[2] ?? null; // may be undefined if not fetched

    // ── Build daily array ───────────────────────────────────────────────
    const daily = ((overallRes.ResultsByTime ?? []) as any[])
      .map((r: any) => ({
        date: (r.TimePeriod as { Start: string }).Start,
        amount: parseFloat(r.Total?.UnblendedCost?.Amount ?? "0"),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Cumulative ──────────────────────────────────────────────────────
    let runningTotal = 0;
    const cumulative = daily.map((d) => {
      runningTotal += d.amount;
      return { date: d.date, amount: d.amount, cumulative: runningTotal };
    });

    const totalSpend = runningTotal;
    const days = daily.length;
    const avgPerDay = days > 0 ? totalSpend / days : 0;
    const last3 = daily.slice(-3);
    const last3Avg = last3.length > 0
      ? last3.reduce((s, d) => s + d.amount, 0) / last3.length
      : avgPerDay;

    // ── Current month MTD ───────────────────────────────────────────────
    let currentMonthTotal = 0;
    let currentMonthDays = 0;

    if (mtdRes) {
      const mtdRows = (mtdRes.ResultsByTime ?? []) as any[];
      currentMonthDays = mtdRows.length;
      currentMonthTotal = mtdRows.reduce(
        (s: number, r: any) => s + parseFloat(r.Total?.UnblendedCost?.Amount ?? "0"),
        0
      );
    } else {
      // MTD is already within the main range — extract from daily
      const monthPrefix = currentMonthStart.slice(0, 7);
      const mtdRows = daily.filter((d) => d.date.startsWith(monthPrefix));
      currentMonthDays = mtdRows.length;
      currentMonthTotal = mtdRows.reduce((s, d) => s + d.amount, 0);
    }

    // ── Service breakdown ───────────────────────────────────────────────
    const serviceMap: Record<string, number> = {};
    for (const r of (serviceRes.ResultsByTime ?? []) as any[]) {
      for (const g of (r.Groups ?? []) as any[]) {
        const svc: string = g.Keys?.[0] ?? "";
        const amt = parseFloat(g.Metrics?.UnblendedCost?.Amount ?? "0");
        if (svc && amt > 0) serviceMap[svc] = (serviceMap[svc] ?? 0) + amt;
      }
    }
    const services = Object.entries(serviceMap)
      .map(([service, total]) => ({ service, total }))
      .sort((a, b) => b.total - a.total);

    // ── Full service daily data ─────────────────────────────────────────
    const serviceData: { date: string; service: string; amount: number }[] = [];
    for (const r of (serviceRes.ResultsByTime ?? []) as any[]) {
      const date: string = (r.TimePeriod as { Start: string }).Start;
      for (const g of (r.Groups ?? []) as any[]) {
        const svc: string = g.Keys?.[0] ?? "";
        const amt = parseFloat(g.Metrics?.UnblendedCost?.Amount ?? "0");
        if (amt > 0) serviceData.push({ date, service: svc, amount: amt });
      }
    }

    // ── RDS per-resource breakdown ─────────────────────────────────────
    let rdsBreakdown: { id: string; amount: number }[] = [];
    try {
      const rdsRes = await ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
        Filter: { Dimensions: { Key: "SERVICE", Values: ["Amazon Relational Database Service"] } },
        GroupBy: [{ Type: "DIMENSION", Key: "RESOURCE_ID" }],
      }));
      const rdsMap: Record<string, number> = {};
      for (const r of (rdsRes.ResultsByTime ?? []) as any[]) {
        for (const g of (r.Groups ?? []) as any[]) {
          const id: string = g.Keys?.[0] ?? "Unknown";
          rdsMap[id] = (rdsMap[id] ?? 0) + parseFloat(g.Metrics?.UnblendedCost?.Amount ?? "0");
        }
      }
      rdsBreakdown = Object.entries(rdsMap)
        .map(([id, amount]) => ({ id, amount }))
        .filter((i) => i.amount > 0.01)
        .sort((a, b) => b.amount - a.amount);
    } catch (e) {
      console.warn("RDS Resource Level Cost Error:", e);
    }

    // ── Available months list (last 6) for UI picker ────────────────────
    const availableMonths: { label: string; value: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(
        Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - i, 1)
      );
      availableMonths.push({
        value: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      });
    }

    // ── Current month label ─────────────────────────────────────────────
    const currentMonthLabel = new Date(
      Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)
    ).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    return NextResponse.json({
      overall: cumulative,
      stats: {
        totalSpend: Math.round(totalSpend * 10000) / 10000,
        days,
        avgPerDay: Math.round(avgPerDay * 10000) / 10000,
        last3DayAvg: Math.round(last3Avg * 10000) / 10000,
        forecast30: Math.round(last3Avg * 30 * 100) / 100,
        forecast60: Math.round(last3Avg * 60 * 100) / 100,
        forecast90: Math.round(last3Avg * 90 * 100) / 100,
        startDate: start,
        endDate: end,
        currentMonthTotal: Math.round(currentMonthTotal * 10000) / 10000,
        currentMonthDays,
        currentMonthLabel,
      },
      services,
      serviceData,
      rdsBreakdown,
      availableMonths,
    });

  } catch (error: unknown) {
    console.error("Cost API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch cost data" },
      { status: 500 }
    );
  }
}
