import { NextResponse } from "next/server";
import { getEc2Client, getRdsClient, getEcsClient, getElbClient, getCloudWatchClient, getCostExplorerClient } from "@/lib/aws-clients";
import { DescribeInstancesCommand, DescribeVolumesCommand, DescribeAddressesCommand, DescribeSecurityGroupsCommand } from "@aws-sdk/client-ec2";
import { DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { ListClustersCommand, DescribeServicesCommand, ListServicesCommand } from "@aws-sdk/client-ecs";
import { DescribeTargetGroupsCommand, DescribeTargetHealthCommand, DescribeLoadBalancersCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

async function safeAwsCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch (e) { console.warn("AWS call failed:", e); return fallback; }
}

async function getCwAvg(cw: ReturnType<typeof getCloudWatchClient>, ns: string, metric: string, dims: { Name: string; Value: string }[], hours = 72): Promise<number> {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600000);
    const res = await cw.send(new GetMetricStatisticsCommand({
      Namespace: ns, MetricName: metric, Dimensions: dims,
      StartTime: start, EndTime: end, Period: hours * 3600, Statistics: ["Average"],
    }));
    return res.Datapoints?.[0]?.Average ?? -1;
  } catch { return -1; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || undefined;

  const ec2 = getEc2Client(region);
  const rds = getRdsClient(region);
  const ecs = getEcsClient(region);
  const alb = getElbClient(region);
  const cw = getCloudWatchClient(region);
  const ce = getCostExplorerClient();

  // ── EC2 Health ────────────────────────────────────────────────
  const ec2Health = await safeAwsCall(async () => {
    const res = await ec2.send(new DescribeInstancesCommand({}));
    const instances: { id: string; state: string; cpu: number }[] = [];
    for (const r of (res.Reservations || [])) {
      for (const inst of (r.Instances || [])) {
        let cpu = -1;
        if (inst.State?.Name === "running") {
          cpu = await getCwAvg(cw, "AWS/EC2", "CPUUtilization", [{ Name: "InstanceId", Value: inst.InstanceId! }], 24);
        }
        instances.push({ id: inst.InstanceId!, state: inst.State?.Name || "unknown", cpu });
      }
    }
    const running = instances.filter(i => i.state === "running");
    const cpuValues = running.filter(i => i.cpu >= 0).map(i => i.cpu);
    return {
      total: instances.length,
      running: running.length,
      stopped: instances.filter(i => i.state === "stopped").length,
      avgCpu: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0,
      maxCpu: cpuValues.length > 0 ? Math.max(...cpuValues) : 0,
      idleCount: cpuValues.filter(c => c < 5).length,
      hotCpuCount: cpuValues.filter(c => c > 85).length,
      diskPressureCount: 0, // will be updated below
    };
  }, { total: 0, running: 0, stopped: 0, avgCpu: 0, maxCpu: 0, idleCount: 0, hotCpuCount: 0, diskPressureCount: 0 });

  // Check disk pressure (EBS volume usage > 85%)
  try {
    const instRes = await ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: "instance-state-name", Values: ["running"] }] }));
    for (const r of (instRes.Reservations || [])) {
      for (const inst of (r.Instances || [])) {
        const diskUsed = await getCwAvg(cw, "CWAgent", "disk_used_percent", [{ Name: "InstanceId", Value: inst.InstanceId! }], 1);
        if (diskUsed > 85) ec2Health.diskPressureCount++;
      }
    }
  } catch { /* CWAgent may not be installed */ }

  // ── RDS Health ────────────────────────────────────────────────
  const rdsHealth = await safeAwsCall(async () => {
    const res = await rds.send(new DescribeDBInstancesCommand({}));
    const dbs = res.DBInstances || [];
    const cpuVals: number[] = [];
    const connVals: number[] = [];
    for (const db of dbs) {
      const cpu = await getCwAvg(cw, "AWS/RDS", "CPUUtilization", [{ Name: "DBInstanceIdentifier", Value: db.DBInstanceIdentifier! }], 24);
      const conn = await getCwAvg(cw, "AWS/RDS", "DatabaseConnections", [{ Name: "DBInstanceIdentifier", Value: db.DBInstanceIdentifier! }], 24);
      if (cpu >= 0) cpuVals.push(cpu);
      if (conn >= 0) connVals.push(conn);
    }
    return {
      total: dbs.length,
      available: dbs.filter(d => d.DBInstanceStatus === "available").length,
      avgCpu: cpuVals.length > 0 ? cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length : 0,
      avgConnections: connVals.length > 0 ? connVals.reduce((a, b) => a + b, 0) / connVals.length : 0,
      maxCpu: cpuVals.length > 0 ? Math.max(...cpuVals) : 0,
    };
  }, { total: 0, available: 0, avgCpu: 0, avgConnections: 0, maxCpu: 0 });

  // ── ECS Health ────────────────────────────────────────────────
  const ecsHealth = await safeAwsCall(async () => {
    const clustersRes = await ecs.send(new ListClustersCommand({}));
    let totalDesired = 0, totalRunning = 0, totalServices = 0;
    for (const arn of (clustersRes.clusterArns || [])) {
      const svcsRes = await ecs.send(new ListServicesCommand({ cluster: arn }));
      const svcArns = (svcsRes.serviceArns || []).slice(0, 10);
      if (svcArns.length === 0) continue;
      const descRes = await ecs.send(new DescribeServicesCommand({ cluster: arn, services: svcArns }));
      for (const svc of (descRes.services || [])) {
        totalServices++;
        totalDesired += (svc as any).desiredCount || 0;
        totalRunning += (svc as any).runningCount || 0;
      }
    }
    return {
      clusters: (clustersRes.clusterArns || []).length,
      services: totalServices,
      desiredTasks: totalDesired,
      runningTasks: totalRunning,
      fillRate: totalDesired > 0 ? (totalRunning / totalDesired) * 100 : 100,
    };
  }, { clusters: 0, services: 0, desiredTasks: 0, runningTasks: 0, fillRate: 100 });

  // ── ALB Unhealthy Targets + 5xx ────────────────────────────────
  const albHealth = await safeAwsCall(async () => {
    const tgRes = await alb.send(new DescribeTargetGroupsCommand({}));
    let totalTargets = 0, unhealthy = 0;
    for (const tg of (tgRes.TargetGroups || [])) {
      const healthRes = await alb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
      const targets = healthRes.TargetHealthDescriptions || [];
      totalTargets += targets.length;
      unhealthy += targets.filter((t: any) => t.TargetHealth?.State !== "healthy").length;
    }

    // ALB 5xx errors
    let alb5xxTotal1h = 0, alb5xxTotal24h = 0;
    try {
      const lbRes = await alb.send(new DescribeLoadBalancersCommand({}));
      for (const lb of (lbRes.LoadBalancers || [])) {
        const lbName = lb.LoadBalancerArn?.split('/').slice(-3).join('/') || '';
        const err1h = await getCwAvg(cw, "AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", [{ Name: "LoadBalancer", Value: lbName }], 1);
        const err24h = await getCwAvg(cw, "AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", [{ Name: "LoadBalancer", Value: lbName }], 24);
        if (err1h > 0) alb5xxTotal1h += err1h;
        if (err24h > 0) alb5xxTotal24h += err24h;
      }
    } catch { }

    return { totalTargets, unhealthy, healthy: totalTargets - unhealthy, targetGroups: (tgRes.TargetGroups || []).length, alb5xxTotal1h: Math.round(alb5xxTotal1h), alb5xxTotal24h: Math.round(alb5xxTotal24h) };
  }, { totalTargets: 0, unhealthy: 0, healthy: 0, targetGroups: 0, alb5xxTotal1h: 0, alb5xxTotal24h: 0 });

  // ── Waste Summary ─────────────────────────────────────────────
  const wasteSummary = await safeAwsCall(async () => {
    const [volRes, eipRes] = await Promise.all([
      ec2.send(new DescribeVolumesCommand({ Filters: [{ Name: "status", Values: ["available"] }] })),
      ec2.send(new DescribeAddressesCommand({})),
    ]);
    const unattachedEbs = (volRes.Volumes || []).length;
    const ebsCost = (volRes.Volumes || []).reduce((s, v) => s + (v.Size || 0) * 0.10, 0);
    const unusedEips = (eipRes.Addresses || []).filter(a => !a.InstanceId && !a.NetworkInterfaceId).length;
    const eipCost = unusedEips * 3.65;
    const idleEc2Cost = ec2Health.idleCount * 20;
    return {
      unattachedEbs,
      unusedEips,
      idleEc2: ec2Health.idleCount,
      estimatedWaste: Math.round(ebsCost + eipCost + idleEc2Cost),
    };
  }, { unattachedEbs: 0, unusedEips: 0, idleEc2: 0, estimatedWaste: 0 });

  // ── Security Summary ──────────────────────────────────────────
  const securitySummary = await safeAwsCall(async () => {
    const sgRes = await ec2.send(new DescribeSecurityGroupsCommand({}));
    const sgs = sgRes.SecurityGroups || [];
    const risky = sgs.filter(sg => {
      const openPorts = (sg.IpPermissions || []).some((p: any) =>
        (p.IpRanges || []).some((r: any) => r.CidrIp === "0.0.0.0/0")
      );
      return openPorts;
    });
    return { totalSGs: sgs.length, riskySGs: risky.length };
  }, { totalSGs: 0, riskySGs: 0 });

  // ── Cost Data for Forecast & Anomaly ──────────────────────────
  const costAnalysis = await safeAwsCall(async () => {
    const end = new Date();
    const start = new Date(end.getTime() - 14 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const res = await ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: fmt(start), End: fmt(end) },
      Granularity: "DAILY",
      Metrics: ["UnblendedCost"],
    }));

    const daily = (res.ResultsByTime || []).map((r: any) => parseFloat(r.Total?.UnblendedCost?.Amount || "0"));
    const total14 = daily.reduce((a, b) => a + b, 0);
    const avgDaily = daily.length > 0 ? total14 / daily.length : 0;
    const last3 = daily.slice(-3);
    const avgLast3 = last3.length > 0 ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;

    // Anomaly: is last 3 day avg > 1.5x of 14-day avg?
    const anomalyThreshold = 1.5;
    const hasAnomaly = avgDaily > 0 && avgLast3 > avgDaily * anomalyThreshold;
    const anomalyPct = avgDaily > 0 ? ((avgLast3 - avgDaily) / avgDaily) * 100 : 0;

    // Forecast
    const forecast30 = Math.round(avgDaily * 30);
    const forecast60 = Math.round(avgDaily * 60);
    const forecast90 = Math.round(avgDaily * 90);

    return {
      avgDaily: Math.round(avgDaily * 100) / 100,
      total14: Math.round(total14 * 100) / 100,
      forecast30,
      forecast60,
      forecast90,
      hasAnomaly,
      anomalyPct: Math.round(anomalyPct),
      last3DayAvg: Math.round(avgLast3 * 100) / 100,
    };
  }, { avgDaily: 0, total14: 0, forecast30: 0, forecast60: 0, forecast90: 0, hasAnomaly: false, anomalyPct: 0, last3DayAvg: 0 });

  // ── Cloud Efficiency Score ────────────────────────────────────
  // Composite score: utilization(30%) + cost optimization(25%) + security(25%) + reliability(20%)
  const utilizationScore = Math.min(100, Math.max(0,
    // Higher CPU = better utilization (inverted: too low is waste)
    // Ideal: 30-70% CPU. Score drops if too low or too high.
    ec2Health.avgCpu > 0 ? (ec2Health.avgCpu < 5 ? 30 : ec2Health.avgCpu < 30 ? 60 : ec2Health.avgCpu <= 70 ? 95 : 70) : 50
  ));

  const costScore = Math.min(100, Math.max(0,
    wasteSummary.estimatedWaste === 0 ? 95 :
    wasteSummary.estimatedWaste < 50 ? 85 :
    wasteSummary.estimatedWaste < 200 ? 65 :
    wasteSummary.estimatedWaste < 500 ? 45 : 25
  ));

  const securityScore = Math.min(100, Math.max(0,
    securitySummary.riskySGs === 0 ? 95 :
    securitySummary.riskySGs <= 2 ? 75 :
    securitySummary.riskySGs <= 5 ? 55 : 30
  ));

  const reliabilityScore = Math.min(100, Math.max(0,
    albHealth.unhealthy === 0 ? 95 :
    albHealth.unhealthy <= 2 ? 70 :
    albHealth.unhealthy <= 5 ? 50 : 25
  ));

  const efficiencyScore = Math.round(
    utilizationScore * 0.3 + costScore * 0.25 + securityScore * 0.25 + reliabilityScore * 0.2
  );

  // ── SRE Incidents (combine alerts) ────────────────────────────
  const incidents = {
    unhealthyTargets: albHealth.unhealthy,
    stoppedInstances: ec2Health.stopped,
    degradedServices: ecsHealth.desiredTasks > ecsHealth.runningTasks ? ecsHealth.desiredTasks - ecsHealth.runningTasks : 0,
    riskySGs: securitySummary.riskySGs,
    totalAlerts: albHealth.unhealthy + ec2Health.stopped + securitySummary.riskySGs + (ecsHealth.desiredTasks > ecsHealth.runningTasks ? 1 : 0),
    highCpuServices: (ec2Health.maxCpu > 80 ? 1 : 0) + (rdsHealth.maxCpu > 80 ? 1 : 0),
  };

  // ── SRE Signals Table ──────────────────────────────────────────
  const signals = [
    { signal: "Running EC2 Instances", value: ec2Health.running, threshold: "N/A", status: ec2Health.running > 0 ? "OK" : "WARN" },
    { signal: "Avg EC2 CPU (24h)", value: ec2Health.avgCpu > 0 ? ec2Health.avgCpu.toFixed(1) : "N/A", threshold: "Warn > 70%", status: ec2Health.avgCpu > 70 ? "WARN" : ec2Health.avgCpu > 85 ? "CRITICAL" : "OK" },
    { signal: "Hot EC2 (CPU > 85%)", value: ec2Health.hotCpuCount, threshold: "> 0", status: ec2Health.hotCpuCount > 0 ? "WARN" : "OK" },
    { signal: "Hot RDS (CPU > 80%)", value: rdsHealth.maxCpu > 80 ? 1 : 0, threshold: "> 0", status: rdsHealth.maxCpu > 80 ? "WARN" : "OK" },
    { signal: "Disk Pressure EC2 (>85%)", value: ec2Health.diskPressureCount, threshold: "> 0", status: ec2Health.diskPressureCount > 0 ? "CRITICAL" : "OK" },
    { signal: "ALB 5xx Total (1h)", value: albHealth.alb5xxTotal1h, threshold: "N/A", status: albHealth.alb5xxTotal1h > 0 ? "WARN" : "OK" },
    { signal: "ALB High 5xx (24h)", value: albHealth.alb5xxTotal24h, threshold: "> 100", status: albHealth.alb5xxTotal24h > 100 ? "CRITICAL" : albHealth.alb5xxTotal24h > 0 ? "WARN" : "OK" },
    { signal: "Unhealthy ALB Targets", value: albHealth.unhealthy, threshold: "> 0", status: albHealth.unhealthy > 0 ? "CRITICAL" : "OK" },
    { signal: "ECS Task Deficit", value: incidents.degradedServices, threshold: "> 0", status: incidents.degradedServices > 0 ? "WARN" : "OK" },
    { signal: "Risky Security Groups", value: securitySummary.riskySGs, threshold: "> 0", status: securitySummary.riskySGs > 0 ? "WARN" : "OK" },
  ];

  return NextResponse.json({
    region: region || process.env.AWS_DEFAULT_REGION || "ap-south-1",
    ec2: ec2Health,
    rds: rdsHealth,
    ecs: ecsHealth,
    alb: albHealth,
    waste: wasteSummary,
    security: securitySummary,
    cost: costAnalysis,
    efficiency: {
      overall: efficiencyScore,
      utilization: utilizationScore,
      costOptimization: costScore,
      security: securityScore,
      reliability: reliabilityScore,
    },
    incidents,
    signals,
  });
}
