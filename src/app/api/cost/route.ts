import { NextResponse } from "next/server";
import { GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { getCostExplorerClient } from "@/lib/aws-clients";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Default: last 15 complete days (today is excluded — AWS Cost Explorer only has data for completed days)
    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0); // midnight UTC today = end of yesterday
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 15);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const start = searchParams.get("start") || fmt(startDate);
    const end = searchParams.get("end") || fmt(endDate);

    const ce = getCostExplorerClient();

    // ── Fetch overall daily cost ───────────────────────────────────────
    const [overallRes, serviceRes] = await Promise.all([
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
    ]);

    // ── Build daily array (sorted ascending) ──────────────────────────
    const daily = ((overallRes.ResultsByTime || []) as any[])
      .map((r) => {
        const tp = r.TimePeriod as { Start: string; End: string };
        const total = r.Total as { UnblendedCost: { Amount: string } };
        return {
          date: tp.Start,
          amount: parseFloat(total?.UnblendedCost?.Amount || "0"),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Compute cumulative & statistics ──────────────────────────────
    let runningTotal = 0;
    const cumulative = daily.map(d => {
      runningTotal += d.amount;
      return { date: d.date, amount: d.amount, cumulative: runningTotal };
    });

    const totalSpend = runningTotal;
    const days = daily.length;
    const avgPerDay = days > 0 ? totalSpend / days : 0;

    // Forecast: based on avg of last 3 days (more representative of current burn rate)
    const last3 = daily.slice(-3);
    const last3Avg = last3.length > 0
      ? last3.reduce((s, d) => s + d.amount, 0) / last3.length
      : avgPerDay;

    // ── Service breakdown ─────────────────────────────────────────────
    const serviceMap: Record<string, number> = {};
    for (const r of (serviceRes.ResultsByTime || []) as Record<string, unknown>[]) {
      for (const g of (r.Groups as Record<string, unknown>[]) || []) {
        const keys = g.Keys as string[];
        const metrics = g.Metrics as { UnblendedCost: { Amount: string } };
        const svc = keys?.[0];
        const amt = parseFloat(metrics?.UnblendedCost?.Amount || "0");
        if (svc && amt > 0) serviceMap[svc] = (serviceMap[svc] || 0) + amt;
      }
    }
    const services = Object.entries(serviceMap)
      .map(([service, total]) => ({ service, total }))
      .sort((a, b) => b.total - a.total);

    // ── Build full service daily data for cost page ───────────────────
    const serviceData: Record<string, unknown>[] = [];
    for (const r of (serviceRes.ResultsByTime || []) as Record<string, unknown>[]) {
      const tp = r.TimePeriod as { Start: string };
      for (const g of (r.Groups as Record<string, unknown>[]) || []) {
        const keys = g.Keys as string[];
        const metrics = g.Metrics as { UnblendedCost: { Amount: string } };
        const svc = keys?.[0];
        const amt = parseFloat(metrics?.UnblendedCost?.Amount || "0");
        if (amt > 0) serviceData.push({ date: tp.Start, service: svc, amount: amt });
      }
    }

    // ── RDS per-resource breakdown ────────────────────────────────────
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
      for (const r of (rdsRes.ResultsByTime || []) as Record<string, unknown>[]) {
        for (const g of (r.Groups as Record<string, unknown>[]) || []) {
          const keys = g.Keys as string[];
          const metrics = g.Metrics as { UnblendedCost: { Amount: string } };
          const id = keys?.[0] || "Unknown";
          rdsMap[id] = (rdsMap[id] || 0) + parseFloat(metrics?.UnblendedCost?.Amount || "0");
        }
      }
      rdsBreakdown = Object.entries(rdsMap)
        .map(([id, amount]) => ({ id, amount }))
        .filter(i => i.amount > 0.01)
        .sort((a, b) => b.amount - a.amount);
    } catch (e) {
      console.warn("RDS Resource Level Cost Error:", e);
    }

    return NextResponse.json({
      // Daily data with cumulative field — 100% accurate from AWS Cost Explorer
      overall: cumulative,
      // Summary statistics
      stats: {
        totalSpend: Math.round(totalSpend * 100) / 100,
        days,
        avgPerDay: Math.round(avgPerDay * 100) / 100,
        last3DayAvg: Math.round(last3Avg * 100) / 100,
        forecast30: Math.round(last3Avg * 30 * 100) / 100,
        forecast60: Math.round(last3Avg * 60 * 100) / 100,
        forecast90: Math.round(last3Avg * 90 * 100) / 100,
        startDate: start,
        endDate: end,
      },
      services,        // Aggregated totals per service (for top-services chart)
      serviceData,     // Per-day per-service (for cost page breakdown)
      rdsBreakdown,
    });

  } catch (error: unknown) {
    console.error("Cost API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch cost data" },
      { status: 500 }
    );
  }
}
