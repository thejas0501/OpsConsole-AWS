import { NextResponse } from "next/server";
import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || process.env.AWS_DEFAULT_REGION || "ap-south-1";

    const dynamo = new DynamoDBClient({ region });
    const tables: Record<string, unknown>[] = [];

    // Paginate table names
    let lastKey: string | undefined;
    const tableNames: string[] = [];
    do {
      const res = await dynamo.send(new ListTablesCommand({ ExclusiveStartTableName: lastKey, Limit: 100 }));
      tableNames.push(...(res.TableNames || []));
      lastKey = res.LastEvaluatedTableName;
    } while (lastKey);

    // Describe each table for details
    await Promise.all(
      tableNames.map(async (name) => {
        try {
          const desc = await dynamo.send(new DescribeTableCommand({ TableName: name }));
          const t = desc.Table!;
          tables.push({
            TableName: t.TableName,
            Status: t.TableStatus,
            ItemCount: t.ItemCount || 0,
            SizeBytes: t.TableSizeBytes || 0,
            BillingMode: t.BillingModeSummary?.BillingMode || "PROVISIONED",
            ReadCapacity: t.ProvisionedThroughput?.ReadCapacityUnits,
            WriteCapacity: t.ProvisionedThroughput?.WriteCapacityUnits,
            Replicas: (t.Replicas || []).length,
          });
        } catch {
          tables.push({ TableName: name, Status: "UNKNOWN", ItemCount: 0, SizeBytes: 0, BillingMode: "UNKNOWN" });
        }
      })
    );

    return NextResponse.json(tables.sort((a, b) => String(a.TableName).localeCompare(String(b.TableName))));
  } catch (error: unknown) {
    console.error("DynamoDB API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch DynamoDB data" }, { status: 500 });
  }
}
