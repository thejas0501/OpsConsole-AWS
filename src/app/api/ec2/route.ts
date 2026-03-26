import { NextResponse } from "next/server";
import {
  DescribeInstancesCommand,
  DescribeInstanceStatusCommand,
  type Reservation,
  type InstanceStatus,
} from "@aws-sdk/client-ec2";
import { getEc2Client } from "@/lib/aws-clients";

// Paginate through all EC2 reservations
async function getAllInstances(ec2: ReturnType<typeof getEc2Client>): Promise<Reservation[]> {
  const reservations: Reservation[] = [];
  let nextToken: string | undefined;
  do {
    const res = await ec2.send(
      new DescribeInstancesCommand({ NextToken: nextToken, MaxResults: 1000 })
    );
    reservations.push(...(res.Reservations || []));
    nextToken = res.NextToken;
  } while (nextToken);
  return reservations;
}

// Paginate through all instance statuses
async function getAllStatuses(ec2: ReturnType<typeof getEc2Client>): Promise<InstanceStatus[]> {
  const statuses: InstanceStatus[] = [];
  let nextToken: string | undefined;
  do {
    const res = await ec2.send(
      new DescribeInstanceStatusCommand({ IncludeAllInstances: true, NextToken: nextToken, MaxResults: 1000 })
    );
    statuses.push(...(res.InstanceStatuses || []));
    nextToken = res.NextToken;
  } while (nextToken);
  return statuses;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    const ec2 = getEc2Client(region);

    const [reservations, statuses] = await Promise.all([
      getAllInstances(ec2),
      getAllStatuses(ec2),
    ]);

    const statusMap: Record<string, string> = {};
    for (const s of statuses) {
      statusMap[s.InstanceId!] = s.InstanceState?.Name || "unknown";
    }

    const instances: Record<string, unknown>[] = [];
    for (const res of reservations) {
      for (const inst of (res.Instances || [])) {
        const nameTag = (inst.Tags || []).find((t) => t.Key === "Name")?.Value || inst.InstanceId;
        instances.push({
          InstanceId: inst.InstanceId,
          Name: nameTag,
          InstanceType: inst.InstanceType,
          State: inst.State?.Name,
          SystemStatus: statusMap[inst.InstanceId!] || inst.State?.Name || "unknown",
          PublicIp: inst.PublicIpAddress || null,
          PrivateIp: inst.PrivateIpAddress || null,
          LaunchTime: inst.LaunchTime,
          Platform: inst.PlatformDetails || "Linux/UNIX",
          AZ: inst.Placement?.AvailabilityZone,
          VpcId: inst.VpcId || null,
          Tags: inst.Tags || [],
        });
      }
    }

    const summary = {
      total: instances.length,
      running: instances.filter((i) => i.State === "running").length,
      stopped: instances.filter((i) => i.State === "stopped").length,
      other: instances.filter((i) => i.State !== "running" && i.State !== "stopped").length,
    };

    return NextResponse.json({ instances, summary });
  } catch (error: unknown) {
    console.error("EC2 API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch EC2 data" },
      { status: 500 }
    );
  }
}
