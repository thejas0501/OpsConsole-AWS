import { NextResponse } from "next/server";
import { getEc2Client, getCloudWatchClient, getElbClient } from "@/lib/aws-clients";
import { DescribeAddressesCommand, DescribeVolumesCommand, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { DescribeLoadBalancersCommand, DescribeTargetGroupsCommand, DescribeTargetHealthCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    const cpuThreshold = parseFloat(searchParams.get("cpu") || "5.0"); // Treat < 5% as idle

    const ec2 = getEc2Client(region);
    const elbv2 = getElbClient(region);
    const cw = getCloudWatchClient(region);

    const waste: Record<string, unknown[]> = {
      unattachedEbs: [],
      unusedEips: [],
      idleEc2: [],
      zeroHealthyTg: []
    };

    // 1. Unused EIPs
    try {
        const eipCmd = new DescribeAddressesCommand({});
        const eipRes = await ec2.send(eipCmd);
        waste.unusedEips = (eipRes.Addresses || []).filter((a: any) => !a.InstanceId && !a.NetworkInterfaceId);
    } catch (e) {
        console.warn("EIP fetch error", e);
    }

    // 2. Unattached EBS
    try {
        const ebsCmd = new DescribeVolumesCommand({
            Filters: [{ Name: "status", Values: ["available"] }]
        });
        const ebsRes = await ec2.send(ebsCmd);
        waste.unattachedEbs = (ebsRes.Volumes || []).map((v: any) => ({
            VolumeId: v.VolumeId,
            Size: v.Size,
            VolumeType: v.VolumeType,
            CreateTime: v.CreateTime,
            // Extract Name tag for human-readable display
            Name: (v.Tags || []).find((t: any) => t.Key === "Name")?.Value || null,
        }));
    } catch (e) {
        console.warn("EBS fetch error", e);
    }

    // 3. Zero Healthy TGs
    try {
        const lbCmd = new DescribeLoadBalancersCommand({});
        const lbRes = await elbv2.send(lbCmd);
        for (const lb of (lbRes.LoadBalancers || [])) {
             const tgCmd = new DescribeTargetGroupsCommand({ LoadBalancerArn: lb.LoadBalancerArn });
             const tgRes = await elbv2.send(tgCmd);
             
             for (const tg of (tgRes.TargetGroups || [])) {
                 const healthCmd = new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn });
                 const healthRes = await elbv2.send(healthCmd);
                 
                 const states = (healthRes.TargetHealthDescriptions || []).map((t: any) => {
                   const th = t.TargetHealth as any;
                   return th?.State;
                 });
                 const healthy = states.filter((s: unknown) => s === 'healthy').length;
                 if (states.length > 0 && healthy === 0) {
                     waste.zeroHealthyTg.push({ TgName: tg.TargetGroupName, LbName: lb.LoadBalancerName });
                 }
             }
        }
    } catch (e) {
        console.warn("TG Health fetch error", e);
    }

    // 4. Idle EC2 Instances (Last 7 Days)
    try {
        const instCmd = new DescribeInstancesCommand({
            Filters: [{ Name: "instance-state-name", Values: ["running"] }]
        });
        const instRes = await ec2.send(instCmd);
        
        const endTime = new Date();
        const startTime7d = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

        for (const res of (instRes.Reservations || [])) {
            for (const inst of (res.Instances || [])) {
                const iId = inst.InstanceId!;
                const nameTag = String((inst.Tags || []).find((t: any) => t.Key === 'Name')?.Value || iId);

                const cpuCmd = new GetMetricStatisticsCommand({
                    Namespace: "AWS/EC2", MetricName: "CPUUtilization",
                    Dimensions: [{ Name: "InstanceId", Value: iId }],
                    StartTime: startTime7d, EndTime: endTime, Period: 86400, Statistics: ["Average"]
                });
                const cpuRes = await cw.send(cpuCmd);
                
                // Calculate average over the 7 days
                const dps = cpuRes.Datapoints || [];
                const avgCpu = dps.length > 0 
                  ? dps.reduce((acc: number, dp: any) => acc + (Number(dp.Average) || 0), 0) / dps.length 
                  : 0;

                if (avgCpu < cpuThreshold) {
                    waste.idleEc2.push({
                        InstanceId: iId,
                        Name: nameTag,
                        InstanceType: inst.InstanceType,
                        CpuAvg7d: avgCpu
                    });
                }
            }
        }
    } catch (e) {
        console.warn("EC2 fetch error", e);
    }

    return NextResponse.json(waste);

  } catch (error: unknown) {
    console.error("Waste API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
