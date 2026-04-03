import { NextResponse } from "next/server";
import {
  CloudFrontClient,
  ListDistributionsCommand,
} from "@aws-sdk/client-cloudfront";

export async function GET() {
  try {
    // CloudFront is always us-east-1 regardless of region
    const cf = new CloudFrontClient({ region: "us-east-1" });

    const distributions: Record<string, unknown>[] = [];
    let marker: string | undefined;

    do {
      const res = await cf.send(new ListDistributionsCommand({ Marker: marker }));
      const list = res.DistributionList;
      const items = list?.Items || [];
      for (const d of items) {
        distributions.push({
          Id: d.Id,
          DomainName: d.DomainName,
          Status: d.Status,
          PriceClass: d.PriceClass,
          HttpVersion: d.HttpVersion,
          Enabled: d.Enabled,
          Aliases: d.Aliases?.Items || [],
          Origins: (d.Origins?.Items || []).map((o: { DomainName?: string }) => o.DomainName),
        });
      }
      marker = list?.IsTruncated ? list.NextMarker : undefined;
    } while (marker);

    return NextResponse.json(distributions);
  } catch (error: unknown) {
    console.error("CloudFront API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch CloudFront data" }, { status: 500 });
  }
}
