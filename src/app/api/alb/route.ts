import { NextResponse } from "next/server";
import { getElbClient, getCloudWatchClient } from "@/lib/aws-clients";
import { DescribeLoadBalancersCommand, DescribeTargetGroupsCommand, DescribeTargetHealthCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    
    const elbv2 = getElbClient(region);
    const cw = getCloudWatchClient(region);
    
    const lbCmd = new DescribeLoadBalancersCommand({});
    const lbRes = await elbv2.send(lbCmd);
    
    const albs: Record<string, unknown>[] = [];
    const targetGroups: Record<string, unknown>[] = [];
    
    const endTime = new Date();
    const startTime24h = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    const startTime1h = new Date(endTime.getTime() - 60 * 60 * 1000);

    for (const lb of (lbRes.LoadBalancers || [])) {
      const albArn = lb.LoadBalancerArn!;
      const albName = lb.LoadBalancerName!;
      
      const albData = {
        Name: albName,
        Scheme: lb.Scheme,
        State: lb.State?.Code,
        VpcId: lb.VpcId,
        DNSName: lb.DNSName,
        error5XX_24h: 0,
        error5XX_1h: 0
      };

      try {
        const dimensions = [{ Name: "LoadBalancer", Value: albArn.split("loadbalancer/")[1] }];
        // 24h Metrics
        const metricCmd24 = new GetMetricStatisticsCommand({
          Namespace: "AWS/ApplicationELB",
          MetricName: "HTTPCode_ELB_5XX_Count",
          Dimensions: dimensions,
          StartTime: startTime24h,
          EndTime: endTime,
          Period: 86400,
          Statistics: ["Sum"]
        });
        const m24 = await cw.send(metricCmd24);
        albData.error5XX_24h = (m24.Datapoints || []).reduce((acc: number, dp: any) => acc + (Number(dp.Sum) || 0), 0) || 0;

        // 1h Metrics
        const metricCmd1 = new GetMetricStatisticsCommand({
            Namespace: "AWS/ApplicationELB",
            MetricName: "HTTPCode_ELB_5XX_Count",
            Dimensions: dimensions,
            StartTime: startTime1h,
            EndTime: endTime,
            Period: 3600,
            Statistics: ["Sum"]
          });
          const m1 = await cw.send(metricCmd1);
          albData.error5XX_1h = (m1.Datapoints || []).reduce((acc: number, dp: any) => acc + (Number(dp.Sum) || 0), 0) || 0;
      } catch (e) {
        console.warn("Metric fetch error for ALB", albName, e);
      }

      albs.push(albData);

      // Fetch Target Groups for ALB
      const tgCmd = new DescribeTargetGroupsCommand({ LoadBalancerArn: albArn });
      const tgRes = await elbv2.send(tgCmd);
      
      for (const tg of (tgRes.TargetGroups || [])) {
         try {
            const healthCmd = new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn });
            const healthRes = await elbv2.send(healthCmd);
            
            const states = (healthRes.TargetHealthDescriptions || []).map((t: any) => {
              const th = t.TargetHealth as any;
              return th?.State;
            });
            const counts = states.reduce((acc: Record<string, number>, val: unknown) => {
              const stateStr = typeof val === 'string' ? val : 'unknown';
              acc[stateStr] = (acc[stateStr] || 0) + 1;
              return acc;
            }, {});
            
            const healthy = counts['healthy'] || 0;
            const total = states.length;
            
            targetGroups.push({
               AlbName: albName,
               TgName: tg.TargetGroupName,
               Healthy: healthy,
               Unhealthy: counts['unhealthy'] || 0,
               Initial: counts['initial'] || 0,
               Draining: counts['draining'] || 0,
               Unused: counts['unused'] || 0,
               Total: total,
               ZeroHealthy: total > 0 && healthy === 0
            });
         } catch (e) {
             console.warn("Target Health fetch error for TG", tg.TargetGroupName, e);
         }
      }
    }
    
    return NextResponse.json({ albs, targetGroups });
  } catch (error: unknown) {
    console.error("ALB API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
