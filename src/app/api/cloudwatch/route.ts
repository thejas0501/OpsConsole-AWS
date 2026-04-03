import { NextResponse } from "next/server";
import {
  CloudWatchClient,
  DescribeAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || process.env.AWS_DEFAULT_REGION || "ap-south-1";

    const cw = new CloudWatchClient({ region });
    const alarms: Record<string, unknown>[] = [];
    let nextToken: string | undefined;

    do {
      const res = await cw.send(new DescribeAlarmsCommand({ NextToken: nextToken, MaxRecords: 100 }));
      for (const a of res.MetricAlarms || []) {
        alarms.push({
          AlarmName: a.AlarmName,
          AlarmDescription: a.AlarmDescription,
          StateValue: a.StateValue,
          Namespace: a.Namespace,
          MetricName: a.MetricName,
          ComparisonOperator: a.ComparisonOperator,
          Threshold: a.Threshold,
          Period: a.Period,
          EvaluationPeriods: a.EvaluationPeriods,
          StateUpdatedTimestamp: a.StateUpdatedTimestamp?.toISOString(),
        });
      }
      nextToken = res.NextToken;
    } while (nextToken);

    return NextResponse.json(alarms);
  } catch (error: unknown) {
    console.error("CloudWatch API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch CloudWatch data" }, { status: 500 });
  }
}
