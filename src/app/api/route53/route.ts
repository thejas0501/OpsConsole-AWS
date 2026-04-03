import { NextResponse } from "next/server";
import {
  Route53Client,
  ListHostedZonesCommand,
} from "@aws-sdk/client-route-53";

export async function GET() {
  try {
    const r53 = new Route53Client({ region: "us-east-1" });
    const zones: Record<string, unknown>[] = [];
    let marker: string | undefined;

    do {
      const res = await r53.send(new ListHostedZonesCommand({ Marker: marker }));
      for (const z of res.HostedZones || []) {
        zones.push({
          Id: z.Id,
          Name: z.Name,
          RecordCount: z.ResourceRecordSetCount,
          PrivateZone: z.Config?.PrivateZone ?? false,
          Comment: z.Config?.Comment || "",
        });
      }
      marker = res.IsTruncated ? res.NextMarker : undefined;
    } while (marker);

    return NextResponse.json(zones);
  } catch (error: unknown) {
    console.error("Route53 API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch Route53 data" }, { status: 500 });
  }
}
