import { NextResponse } from "next/server";
import { EC2Client, DescribeInstancesCommand, DescribeVpcsCommand } from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { ECSClient, ListClustersCommand, DescribeClustersCommand, ListServicesCommand, DescribeServicesCommand } from "@aws-sdk/client-ecs";
import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeTargetGroupsCommand, DescribeTargetHealthCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { ElastiCacheClient, DescribeCacheClustersCommand } from "@aws-sdk/client-elasticache";

function getCreds() {
  if (!process.env.AWS_ACCESS_KEY_ID) return undefined;
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
    sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
  };
}
function getRegion(r?: string | null) { return r || process.env.AWS_DEFAULT_REGION || "ap-south-1"; }

interface FlowNode { id: string; type: string; label: string; subLabel: string; status: string; vpcId?: string; [k: string]: unknown; }
interface FlowEdge { id: string; source: string; target: string; label?: string; }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = getRegion(searchParams.get("region"));
  const creds = getCreds();
  const cfg = { region, credentials: creds };

  const ec2 = new EC2Client(cfg);
  const rds = new RDSClient(cfg);
  const ecs = new ECSClient(cfg);
  const albClient = new ElasticLoadBalancingV2Client(cfg);
  const elasticache = new ElastiCacheClient(cfg);

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(source: string, target: string, label?: string) {
    const key = `${source}→${target}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ id: `e-${source}-${target}`, source, target, label });
  }

  try {
    // ── Internet entry point ──
    nodes.push({ id: "internet", type: "internet", label: "Internet / Users", subLabel: "Incoming requests", status: "active" });

    // ── VPCs ──
    const vpcIds: string[] = [];
    try {
      const vpcs = await ec2.send(new DescribeVpcsCommand({}));
      for (const vpc of (vpcs.Vpcs || [])) {
        const name = (vpc.Tags || []).find((t: any) => t.Key === "Name")?.Value || vpc.VpcId;
        nodes.push({ id: vpc.VpcId!, type: "vpc", label: name!, subLabel: vpc.CidrBlock || "", status: "available", vpcId: vpc.VpcId });
        vpcIds.push(vpc.VpcId!);
      }
    } catch (e) { console.warn("VPC fetch error:", e); }

    // ── ALBs ──
    const albIds: string[] = [];
    const albArnToId: Record<string, string> = {};
    try {
      const albRes = await albClient.send(new DescribeLoadBalancersCommand({}));
      for (const lb of (albRes.LoadBalancers || [])) {
        const id = `alb-${lb.LoadBalancerName}`;
        albIds.push(id);
        albArnToId[lb.LoadBalancerArn!] = id;
        nodes.push({ id, type: "alb", label: lb.LoadBalancerName!, subLabel: `${lb.Type || "ALB"} · ${lb.Scheme || ""}`, status: lb.State?.Code || "active", vpcId: lb.VpcId });
        // Internet → ALB
        addEdge("internet", id, "HTTPS");
        // ALB → VPC
        if (lb.VpcId && vpcIds.includes(lb.VpcId)) {
          addEdge(lb.VpcId, id, "contains");
        }
      }
    } catch (e) { console.warn("ALB fetch error:", e); }

    // ── Target Groups (to map ALB → instances) ──
    const tgTargetInstances: Record<string, string[]> = {}; // albId → instanceIds
    try {
      const tgRes = await albClient.send(new DescribeTargetGroupsCommand({}));
      for (const tg of (tgRes.TargetGroups || [])) {
        const lbArns = tg.LoadBalancerArns || [];
        try {
          const healthRes = await albClient.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
          const targetIds = (healthRes.TargetHealthDescriptions || []).map((t: any) => t.Target?.Id).filter(Boolean);
          for (const arn of lbArns) {
            const albId = albArnToId[arn];
            if (albId) {
              if (!tgTargetInstances[albId]) tgTargetInstances[albId] = [];
              tgTargetInstances[albId].push(...targetIds);
            }
          }
        } catch { /* skip */ }
      }
    } catch (e) { console.warn("TG fetch error:", e); }

    // ── EC2 ──
    const ec2Ids: string[] = [];
    const ec2VpcMap: Record<string, string> = {}; // ec2NodeId → vpcId
    try {
      const instRes = await ec2.send(new DescribeInstancesCommand({}));
      for (const res of (instRes.Reservations || [])) {
        for (const inst of (res.Instances || [])) {
          const name = (inst.Tags || []).find((t: any) => t.Key === "Name")?.Value || inst.InstanceId;
          const id = `ec2-${inst.InstanceId}`;
          ec2Ids.push(id);
          if (inst.VpcId) ec2VpcMap[id] = inst.VpcId;
          nodes.push({ id, type: "ec2", label: name!, subLabel: `${inst.InstanceType} · ${inst.PrivateIpAddress || ""}`, status: inst.State?.Name || "unknown", vpcId: inst.VpcId });

          // ALB → EC2 (if this instance is a target)
          for (const [albId, targets] of Object.entries(tgTargetInstances)) {
            if (targets.includes(inst.InstanceId!)) {
              addEdge(albId, id, "routes to");
            }
          }
          // VPC → EC2
          if (inst.VpcId && vpcIds.includes(inst.VpcId)) {
            addEdge(inst.VpcId, id, "contains");
          }
        }
      }
    } catch (e) { console.warn("EC2 fetch error:", e); }

    // If no ALBs, connect Internet directly to EC2s
    if (albIds.length === 0 && ec2Ids.length > 0) {
      for (const eid of ec2Ids.slice(0, 5)) {
        addEdge("internet", eid, "direct");
      }
    }

    // ── ECS ──
    const ecsServiceIds: string[] = [];
    try {
      const clustersRes = await ecs.send(new ListClustersCommand({}));
      const clusterArns = clustersRes.clusterArns || [];
      if (clusterArns.length > 0) {
        const descRes = await ecs.send(new DescribeClustersCommand({ clusters: clusterArns }));
        for (const cluster of (descRes.clusters || [])) {
          const c = cluster as any;
          const clusterId = `ecs-cluster-${c.clusterName}`;
          nodes.push({ id: clusterId, type: "ecs-cluster", label: c.clusterName, subLabel: `${c.registeredContainerInstancesCount || 0} instances · ${c.runningTasksCount || 0} tasks`, status: c.status || "ACTIVE" });

          // ALB → ECS Cluster (if ALBs exist)
          for (const albId of albIds) {
            addEdge(albId, clusterId, "routes to");
          }
          if (albIds.length === 0) {
            addEdge("internet", clusterId, "traffic");
          }

          // Services
          try {
            const svcsRes = await ecs.send(new ListServicesCommand({ cluster: c.clusterArn }));
            if ((svcsRes.serviceArns || []).length > 0) {
              const svcDesc = await ecs.send(new DescribeServicesCommand({ cluster: c.clusterArn, services: svcsRes.serviceArns!.slice(0, 10) }));
              for (const svc of (svcDesc.services || [])) {
                const s = svc as any;
                const svcId = `ecs-svc-${s.serviceName}`;
                ecsServiceIds.push(svcId);
                nodes.push({ id: svcId, type: "ecs", label: s.serviceName, subLabel: `${s.runningCount}/${s.desiredCount} tasks · ${s.launchType || "EC2"}`, status: s.status || "ACTIVE" });
                addEdge(clusterId, svcId, "runs");
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) { console.warn("ECS fetch error:", e); }

    // ── RDS ──
    const rdsIds: string[] = [];
    try {
      const rdsRes = await rds.send(new DescribeDBInstancesCommand({}));
      for (const db of (rdsRes.DBInstances || [])) {
        const id = `rds-${db.DBInstanceIdentifier}`;
        rdsIds.push(id);
        const dbVpc = db.DBSubnetGroup?.VpcId;
        nodes.push({ id, type: "rds", label: db.DBInstanceIdentifier!, subLabel: `${db.DBInstanceClass} · ${db.Engine} ${db.EngineVersion || ""}`, status: db.DBInstanceStatus || "unknown", vpcId: dbVpc });

        // ECS services → RDS
        for (const svcId of ecsServiceIds) {
          addEdge(svcId, id, "queries DB");
        }
        // EC2 → RDS (same VPC)
        for (const eid of ec2Ids) {
          if (dbVpc && ec2VpcMap[eid] === dbVpc) {
            addEdge(eid, id, "queries DB");
          }
        }
        // If no compute connected, connect from cluster
        if (ecsServiceIds.length === 0 && ec2Ids.length === 0) {
          addEdge("internet", id, "DB access");
        }
        // VPC → RDS
        if (dbVpc && vpcIds.includes(dbVpc)) {
          addEdge(dbVpc, id, "contains");
        }
      }
    } catch (e) { console.warn("RDS fetch error:", e); }

    // ── ElastiCache ──
    try {
      const ecRes = await elasticache.send(new DescribeCacheClustersCommand({}));
      for (const cluster of (ecRes.CacheClusters || [])) {
        const c = cluster as any;
        const id = `cache-${c.CacheClusterId}`;
        nodes.push({ id, type: "elasticache", label: c.CacheClusterId, subLabel: `${c.Engine} ${c.EngineVersion} · ${c.CacheNodeType}`, status: c.CacheClusterStatus || "unknown" });

        // ECS/EC2 → ElastiCache
        for (const svcId of ecsServiceIds) {
          addEdge(svcId, id, "cache read/write");
        }
        for (const eid of ec2Ids.slice(0, 3)) {
          addEdge(eid, id, "cache");
        }
      }
    } catch (e) { console.warn("ElastiCache fetch error:", e); }

    return NextResponse.json({ nodes, edges });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
