import { NextResponse } from "next/server";
import { EC2Client, DescribeInstancesCommand, DescribeVolumesCommand, DescribeAddressesCommand } from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { ECSClient, ListClustersCommand, ListServicesCommand, DescribeServicesCommand } from "@aws-sdk/client-ecs";
import { S3Client, ListBucketsCommand, GetBucketLifecycleConfigurationCommand } from "@aws-sdk/client-s3";
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { ElasticLoadBalancingV2Client, DescribeTargetGroupsCommand, DescribeTargetHealthCommand } from "@aws-sdk/client-elastic-load-balancing-v2";

function getCreds() {
  if (!process.env.AWS_ACCESS_KEY_ID) return undefined;
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
    sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
  };
}

function getRegion(r?: string | null) { return r || process.env.AWS_DEFAULT_REGION || "ap-south-1"; }

interface Finding {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  resource: string;
  resourceType: string;
  finding: string;
  suggestion: string;
  estimatedMonthlySavings?: number;
  data?: Record<string, unknown>;
}

async function getCwAvg(cw: CloudWatchClient, namespace: string, metric: string, dims: {Name:string;Value:string}[], hours = 72): Promise<number> {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600000);
    const res = await cw.send(new GetMetricStatisticsCommand({
      Namespace: namespace, MetricName: metric, Dimensions: dims,
      StartTime: start, EndTime: end, Period: hours * 3600, Statistics: ["Average"],
    }));
    return res.Datapoints?.[0]?.Average ?? -1;
  } catch { return -1; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = getRegion(searchParams.get("region"));
  const creds = getCreds();
  const cfg = { region, credentials: creds };
  const cfgGlobal = { region: "us-east-1", credentials: creds };

  const ec2 = new EC2Client(cfg);
  const rds = new RDSClient(cfg);
  const ecs = new ECSClient(cfg);
  const s3 = new S3Client(cfgGlobal);
  const cw = new CloudWatchClient(cfg);
  const alb = new ElasticLoadBalancingV2Client(cfg);

  const findings: Finding[] = [];
  let totalSavings = 0;

  try {
    // ─── EC2: stopped instances ───────────────────────────────────────────
    try {
      const ec2Res = await ec2.send(new DescribeInstancesCommand({}));
      for (const res of (ec2Res.Reservations || [])) {
        for (const inst of (res.Instances || [])) {
          const name = (inst.Tags || []).find((t: any) => t.Key === "Name")?.Value || inst.InstanceId;
          if (inst.State?.Name === "stopped") {
            const est = 30; // ~$30/mo per stopped instance (still paying for EBS)
            totalSavings += est;
            findings.push({
              id: inst.InstanceId!, severity: "warning", category: "EC2", resource: name!, resourceType: "EC2 Instance",
              finding: `Instance is in STOPPED state but EBS volumes are still incurring costs.`,
              suggestion: `Terminate ${name} if no longer needed, or create an AMI and terminate to stop EBS charges. Estimated ~$${est}/mo saved on attached EBS.`,
              estimatedMonthlySavings: est,
            });
          }

          // EC2 low CPU check
          if (inst.State?.Name === "running") {
            const cpu = await getCwAvg(cw, "AWS/EC2", "CPUUtilization",
              [{ Name: "InstanceId", Value: inst.InstanceId! }]);
            if (cpu !== -1 && cpu < 5) {
              const est = 20;
              totalSavings += est;
              findings.push({
                id: inst.InstanceId!, severity: "warning", category: "EC2", resource: name!, resourceType: "EC2 Instance",
                finding: `Average CPU is ${cpu.toFixed(1)}% over last 72h — extremely low utilization.`,
                suggestion: `Downsize ${name} (${inst.InstanceType}) to a smaller instance type, or investigate if the workload can be moved to a serverless/container solution.`,
                estimatedMonthlySavings: est,
                data: { cpu: cpu.toFixed(1), instanceType: inst.InstanceType },
              });
            }
          }
        }
      }

      // Unattached EBS
      const volRes = await ec2.send(new DescribeVolumesCommand({ Filters: [{ Name: "status", Values: ["available"] }] }));
      for (const vol of (volRes.Volumes || [])) {
        const name = (vol.Tags || []).find((t: any) => t.Key === "Name")?.Value || vol.VolumeId;
        const gbCost = (vol.Size || 0) * 0.10;
        totalSavings += gbCost;
        findings.push({
          id: vol.VolumeId!, severity: "critical", category: "EBS", resource: name!, resourceType: "EBS Volume",
          finding: `Unattached EBS volume (${vol.Size}GB, ${vol.VolumeType}). Costs ~$${gbCost.toFixed(0)}/mo with no associated instance.`,
          suggestion: `Create a snapshot of ${name} and then delete the volume. Restore from snapshot if needed.`,
          estimatedMonthlySavings: Math.round(gbCost),
        });
      }

      // Unused Elastic IPs
      const eipRes = await ec2.send(new DescribeAddressesCommand({}));
      for (const eip of (eipRes.Addresses || [])) {
        if (!eip.InstanceId && !eip.NetworkInterfaceId) {
          totalSavings += 4;
          findings.push({
            id: eip.AllocationId!, severity: "critical", category: "Networking", resource: eip.PublicIp!, resourceType: "Elastic IP",
            finding: `Elastic IP ${eip.PublicIp} is allocated but not associated with any instance or interface.`,
            suggestion: "Release this Elastic IP to avoid the ~$3.65/mo idle charge.",
            estimatedMonthlySavings: 4,
          });
        }
      }
    } catch (e) { console.error("EC2 findings error:", e); }

    // ─── RDS: over-provisioned ───────────────────────────────────────────
    try {
      const rdsRes = await rds.send(new DescribeDBInstancesCommand({}));
      for (const db of (rdsRes.DBInstances || [])) {
        const dbId = db.DBInstanceIdentifier!;
        const cpu = await getCwAvg(cw, "AWS/RDS", "CPUUtilization", [{ Name: "DBInstanceIdentifier", Value: dbId }]);
        const conn = await getCwAvg(cw, "AWS/RDS", "DatabaseConnections", [{ Name: "DBInstanceIdentifier", Value: dbId }]);
        
        if (cpu !== -1 && cpu < 10) {
          const est = 50;
          totalSavings += est;
          findings.push({
            id: dbId, severity: cpu < 5 ? "critical" : "warning", category: "RDS", resource: dbId, resourceType: "RDS Instance",
            finding: `Average CPU: ${cpu.toFixed(1)}%, Avg Connections: ${conn < 0 ? "N/A" : conn.toFixed(0)} over last 72h. Instance class: ${db.DBInstanceClass}.`,
            suggestion: `Downsize ${dbId} from ${db.DBInstanceClass} to a smaller class (e.g., db.t3.micro or db.t4g.small). Consider Reserved Instances for consistent workloads.`,
            estimatedMonthlySavings: est,
            data: { cpu: cpu.toFixed(1), connections: conn.toFixed(0), instanceClass: db.DBInstanceClass },
          });
        }

        // Multi-AZ check for dev/low-usage
        if (db.MultiAZ && cpu !== -1 && cpu < 5 && conn !== -1 && conn < 2) {
          const est = 80;
          totalSavings += est;
          findings.push({
            id: `${dbId}-multiaz`, severity: "info", category: "RDS", resource: dbId, resourceType: "RDS Multi-AZ",
            finding: `Multi-AZ is enabled but usage is very low (CPU ${cpu.toFixed(1)}%, ${conn.toFixed(0)} connections). Likely a dev/test DB paying double.`,
            suggestion: `If this is a non-production database, disable Multi-AZ for ~$${est}/mo savings.`,
            estimatedMonthlySavings: est,
          });
        }
      }
    } catch (e) { console.error("RDS findings error:", e); }

    // ─── ECS: over-provisioned ───────────────────────────────────────────
    try {
      const clustersRes = await ecs.send(new ListClustersCommand({}));
      for (const clusterArn of (clustersRes.clusterArns || [])) {
        const svcsRes = await ecs.send(new ListServicesCommand({ cluster: clusterArn }));
        if ((svcsRes.serviceArns || []).length === 0) continue;
        const chunks = svcsRes.serviceArns!.slice(0, 10);
        const descRes = await ecs.send(new DescribeServicesCommand({ cluster: clusterArn, services: chunks }));
        for (const svc of (descRes.services || [])) {
          if ((svc as any).desiredCount > 2 && (svc as any).runningCount < (svc as any).desiredCount * 0.5) {
            findings.push({
              id: (svc as any).serviceName, severity: "warning", category: "ECS", resource: (svc as any).serviceName, resourceType: "ECS Service",
              finding: `Desired: ${(svc as any).desiredCount} tasks, Running: ${(svc as any).runningCount} tasks. Service is drastically under-running.`,
              suggestion: `Review the desired count for ${(svc as any).serviceName}. Consider auto-scaling based on CPU/memory instead of a fixed desired count.`,
            });
          }
        }
      }
    } catch (e) { console.error("ECS findings error:", e); }

    // ─── S3: no lifecycle policy ─────────────────────────────────────────
    try {
      const bucketsRes = await s3.send(new ListBucketsCommand({}));
      for (const b of (bucketsRes.Buckets || []).slice(0, 20)) {
        try {
          await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: b.Name! }));
        } catch (e: any) {
          if (e?.name === "NoSuchLifecycleConfiguration") {
            findings.push({
              id: b.Name!, severity: "info", category: "S3", resource: b.Name!, resourceType: "S3 Bucket",
              finding: `Bucket "${b.Name}" has no lifecycle policy configured.`,
              suggestion: `Add a lifecycle policy to transition old objects to S3-IA or Glacier after 30-90 days, and expire incomplete multipart uploads.`,
            });
          }
        }
      }
    } catch (e) { console.error("S3 findings error:", e); }

    // ─── ALB: empty target groups ────────────────────────────────────────
    try {
      const tgRes = await alb.send(new DescribeTargetGroupsCommand({}));
      for (const tg of (tgRes.TargetGroups || [])) {
        const healthRes = await alb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
        const targets = healthRes.TargetHealthDescriptions || [];
        if (targets.length === 0) {
          findings.push({
            id: tg.TargetGroupArn!, severity: "warning", category: "ALB", resource: tg.TargetGroupName!, resourceType: "Target Group",
            finding: `Target group "${tg.TargetGroupName}" has zero registered targets.`,
            suggestion: `If this target group is not needed, delete it and any associated load balancer rules to reduce complexity and costs.`,
          });
        } else {
          const unhealthy = targets.filter((t: any) => t.TargetHealth?.State !== "healthy").length;
          if (unhealthy > 0) {
            findings.push({
              id: `${tg.TargetGroupArn}-unhealthy`, severity: "critical", category: "ALB", resource: tg.TargetGroupName!, resourceType: "Target Group",
              finding: `${unhealthy}/${targets.length} targets are unhealthy in target group "${tg.TargetGroupName}".`,
              suggestion: `Investigate the health check configuration and ensure instances are healthy. Unhealthy targets may indicate application failures.`,
              data: { unhealthy, total: targets.length },
            });
          }
        }
      }
    } catch (e) { console.error("ALB findings error:", e); }

    const bySeverity = {
      critical: findings.filter(f => f.severity === "critical").length,
      warning: findings.filter(f => f.severity === "warning").length,
      info: findings.filter(f => f.severity === "info").length,
    };

    return NextResponse.json({
      findings,
      summary: {
        total: findings.length,
        ...bySeverity,
        estimatedMonthlySavings: Math.round(totalSavings),
        estimatedAnnualSavings: Math.round(totalSavings * 12),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate optimization report" }, { status: 500 });
  }
}
