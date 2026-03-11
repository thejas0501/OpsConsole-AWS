import { NextResponse } from "next/server";
import { getRdsClient, getCloudWatchClient } from "@/lib/aws-clients";
import { DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    
    const rds = getRdsClient(region);
    const cw = getCloudWatchClient(region);
    
    const dbCmd = new DescribeDBInstancesCommand({});
    const dbRes = await rds.send(dbCmd);
    
    const results: Record<string, unknown>[] = [];
    
    const endTime = new Date();
    const startTime24h = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    
    for (const db of (dbRes.DBInstances || [])) {
        const dbId = db.DBInstanceIdentifier!;
        
        let cpuAvg = 0;
        let storageMin = 0;
        let connectionsMax = 0;
        
        try {
            const dimensions = [{ Name: "DBInstanceIdentifier", Value: dbId }];
            
            // CPU
            const cpuCmd = new GetMetricStatisticsCommand({
                Namespace: "AWS/RDS", MetricName: "CPUUtilization", Dimensions: dimensions,
                StartTime: startTime24h, EndTime: endTime, Period: 86400, Statistics: ["Average"]
            });
            const cpuRes = await cw.send(cpuCmd);
            cpuAvg = cpuRes.Datapoints?.[0]?.Average || 0;
            
            // Storage
            const storageCmd = new GetMetricStatisticsCommand({
                Namespace: "AWS/RDS", MetricName: "FreeStorageSpace", Dimensions: dimensions,
                StartTime: startTime24h, EndTime: endTime, Period: 86400, Statistics: ["Minimum"]
            });
            const storageRes = await cw.send(storageCmd);
            storageMin = storageRes.Datapoints?.[0]?.Minimum || 0; // bytes
            
            // Connections
            const connCmd = new GetMetricStatisticsCommand({
                Namespace: "AWS/RDS", MetricName: "DatabaseConnections", Dimensions: dimensions,
                StartTime: startTime24h, EndTime: endTime, Period: 86400, Statistics: ["Maximum"]
            });
            const connRes = await cw.send(connCmd);
            connectionsMax = connRes.Datapoints?.[0]?.Maximum || 0;
            
        } catch (e) {
            console.warn("Metric error for RDS", dbId, e);
        }
        
        const allocatedGB = db.AllocatedStorage || 0;
        const allocatedBytes = allocatedGB * 1024 * 1024 * 1024;
        
        const isRisky = (cpuAvg > 80) || ((storageMin > 0) && (storageMin < allocatedBytes * 0.1));
        
        results.push({
            Identifier: dbId,
            Class: db.DBInstanceClass,
            Engine: db.Engine,
            Status: db.DBInstanceStatus,
            AllocatedStorageGB: allocatedGB,
            CpuAvg: cpuAvg,
            FreeStorageBytesMin: storageMin,
            ConnectionsMax: connectionsMax,
            IsRisky: isRisky
        });
    }

    return NextResponse.json(results);
  } catch (error: unknown) {
     console.error("RDS API Error:", error);
     return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
