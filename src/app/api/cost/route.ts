import { NextResponse } from "next/server";
import { GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { getCostExplorerClient } from "@/lib/aws-clients";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start"); // YYYY-MM-DD
    const end = searchParams.get("end");     // YYYY-MM-DD
    
    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
    }

    const ce = getCostExplorerClient();
    
    // Overall daily cost
    const overallCommand = new GetCostAndUsageCommand({
      TimePeriod: { Start: start, End: end },
      Granularity: "DAILY",
      Metrics: ["UnblendedCost"],
    });
    
    const overallResponse = await ce.send(overallCommand);
    
    // Service-wise cost
    const serviceCommand = new GetCostAndUsageCommand({
      TimePeriod: { Start: start, End: end },
      Granularity: "DAILY",
      Metrics: ["UnblendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }]
    });
    
    const serviceResponse = await ce.send(serviceCommand);

    const overallCosts = (overallResponse.ResultsByTime || []).map((r: any) => {
      const tp = r.TimePeriod as any;
      const total = r.Total as any;
      return {
        date: tp?.Start,
        amount: parseFloat(String(total?.UnblendedCost?.Amount || "0"))
      };
    });
    
    const serviceData: Record<string, unknown>[] = [];
    ((serviceResponse.ResultsByTime as any[]) || []).forEach((r: any) => {
      const tp = r.TimePeriod as any;
      const date = tp?.Start;
      ((r.Groups as any[]) || []).forEach((g: any) => {
        const keys = g.Keys as string[] | undefined;
        const metrics = g.Metrics as any;
        const service = keys?.[0];
        const amount = parseFloat(String(metrics?.UnblendedCost?.Amount || "0"));
        if (amount > 0) {
           serviceData.push({ date, service, amount });
        }
      });
    });

    // RDS per-resource cost (requires Resource Level Data enabled in Cost Explorer)
    let rdsData: any[] = [];
    try {
      const rdsSubCommand = new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
        Filter: {
          Dimensions: {
            Key: "SERVICE",
            Values: ["Amazon Relational Database Service"]
          }
        },
        GroupBy: [{ Type: "DIMENSION", Key: "RESOURCE_ID" }]
      });
      const rdsSubRes = await ce.send(rdsSubCommand);
      
      const rdsMap: Record<string, number> = {};
      (rdsSubRes.ResultsByTime || []).forEach((r: any) => {
        (r.Groups || []).forEach((g: any) => {
          const resId = g.Keys?.[0] || "Unknown";
          const amt = parseFloat(g.Metrics?.UnblendedCost?.Amount || "0");
          rdsMap[resId] = (rdsMap[resId] || 0) + amt;
        });
      });
      rdsData = Object.entries(rdsMap)
        .map(([id, amount]) => ({ id, amount }))
        .filter(i => i.amount > 0.01)
        .sort((a, b) => b.amount - a.amount);
    } catch (e) {
      console.warn("RDS Resource Level Cost Error:", e);
    }

    return NextResponse.json({ 
      overall: overallCosts, 
      services: serviceData,
      rdsBreakdown: rdsData
    });

  } catch (error: unknown) {
    console.error("Cost API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch cost data" }, { status: 500 });
  }
}
