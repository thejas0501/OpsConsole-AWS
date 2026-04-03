import { NextResponse } from "next/server";
import { getLambdaClient, getCloudWatchClient } from "@/lib/aws-clients";
import { ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;

    const lambda = getLambdaClient(region);
    const cw = getCloudWatchClient(region);

    // Paginate through all functions
    const functions = [];
    let marker: string | undefined;
    do {
      const res = await lambda.send(new ListFunctionsCommand({ Marker: marker, MaxItems: 50 }));
      functions.push(...(res.Functions || []));
      marker = res.NextMarker;
    } while (marker);

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 15 * 24 * 60 * 60 * 1000);

    // Fetch CloudWatch metrics for each function (in batches to avoid throttling)
    const results = await Promise.all(
      functions.map(async (fn) => {
        const dims = [{ Name: "FunctionName", Value: fn.FunctionName! }];
        const baseParams = { Namespace: "AWS/Lambda", Dimensions: dims, StartTime: startTime, EndTime: endTime, Period: 15 * 86400 };

        const [invRes, errRes, durRes, throttleRes] = await Promise.allSettled([
          cw.send(new GetMetricStatisticsCommand({ ...baseParams, MetricName: "Invocations", Statistics: ["Sum"] })),
          cw.send(new GetMetricStatisticsCommand({ ...baseParams, MetricName: "Errors", Statistics: ["Sum"] })),
          cw.send(new GetMetricStatisticsCommand({ ...baseParams, MetricName: "Duration", Statistics: ["Average"] })),
          cw.send(new GetMetricStatisticsCommand({ ...baseParams, MetricName: "Throttles", Statistics: ["Sum"] })),
        ]);

        return {
          FunctionName: fn.FunctionName,
          Runtime: fn.Runtime,
          MemorySize: fn.MemorySize,
          Timeout: fn.Timeout,
          LastModified: fn.LastModified,
          CodeSize: fn.CodeSize,
          Invocations: invRes.status === "fulfilled" ? (invRes.value.Datapoints?.[0]?.Sum ?? 0) : 0,
          Errors: errRes.status === "fulfilled" ? (errRes.value.Datapoints?.[0]?.Sum ?? 0) : 0,
          Duration: durRes.status === "fulfilled" ? (durRes.value.Datapoints?.[0]?.Average ?? null) : null,
          Throttles: throttleRes.status === "fulfilled" ? (throttleRes.value.Datapoints?.[0]?.Sum ?? 0) : 0,
        };
      })
    );

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error("Lambda API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch Lambda data" }, { status: 500 });
  }
}
