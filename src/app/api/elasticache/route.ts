import { NextResponse } from "next/server";
import { ElastiCacheClient, DescribeCacheClustersCommand } from "@aws-sdk/client-elasticache";

function getElastiCacheClient(region?: string) {
  return new ElastiCacheClient({
    region: region || process.env.AWS_DEFAULT_REGION || "ap-south-1",
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
      sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
    } : undefined,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    const client = getElastiCacheClient(region);

    const res = await client.send(new DescribeCacheClustersCommand({ ShowCacheNodeInfo: true }));

    const clusters = (res.CacheClusters || []).map((c: any) => ({
      ClusterId: c.CacheClusterId,
      Engine: c.Engine,
      EngineVersion: c.EngineVersion,
      Status: c.CacheClusterStatus,
      NodeType: c.CacheNodeType,
      NumNodes: c.NumCacheNodes,
      ReplicationGroupId: c.ReplicationGroupId,
      Endpoint: c.ConfigurationEndpoint?.Address || c.CacheNodes?.[0]?.Endpoint?.Address,
      Port: c.ConfigurationEndpoint?.Port || c.CacheNodes?.[0]?.Endpoint?.Port,
      CreatedAt: c.CacheClusterCreateTime,
    }));

    const summary = {
      total: clusters.length,
      available: clusters.filter((c: any) => c.Status === "available").length,
      redis: clusters.filter((c: any) => c.Engine === "redis").length,
      memcached: clusters.filter((c: any) => c.Engine === "memcached").length,
    };

    return NextResponse.json({ clusters, summary });
  } catch (error: unknown) {
    console.error("ElastiCache API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch ElastiCache data" }, { status: 500 });
  }
}
