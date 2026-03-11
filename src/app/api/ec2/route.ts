import { NextResponse } from "next/server";
import { EC2Client, DescribeInstancesCommand, DescribeInstanceStatusCommand } from "@aws-sdk/client-ec2";

function getEc2Client(region?: string) {
  return new EC2Client({
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
    const ec2 = getEc2Client(region);

    const instRes = await ec2.send(new DescribeInstancesCommand({}));
    const statusRes = await ec2.send(new DescribeInstanceStatusCommand({ IncludeAllInstances: true }));

    const statusMap: Record<string, string> = {};
    for (const s of (statusRes.InstanceStatuses || [])) {
      statusMap[s.InstanceId!] = s.InstanceState?.Name || "unknown";
    }

    const instances: Record<string, unknown>[] = [];
    for (const res of (instRes.Reservations || [])) {
      for (const inst of (res.Instances || [])) {
        const nameTag = (inst.Tags || []).find((t: any) => t.Key === "Name")?.Value || inst.InstanceId;
        instances.push({
          InstanceId: inst.InstanceId,
          Name: nameTag,
          InstanceType: inst.InstanceType,
          State: inst.State?.Name,
          PublicIp: inst.PublicIpAddress,
          PrivateIp: inst.PrivateIpAddress,
          LaunchTime: inst.LaunchTime,
          Platform: inst.PlatformDetails || "Linux/UNIX",
          AZ: inst.Placement?.AvailabilityZone,
          VpcId: inst.VpcId,
        });
      }
    }

    const summary = {
      total: instances.length,
      running: instances.filter((i: any) => i.State === "running").length,
      stopped: instances.filter((i: any) => i.State === "stopped").length,
      other: instances.filter((i: any) => i.State !== "running" && i.State !== "stopped").length,
    };

    return NextResponse.json({ instances, summary });
  } catch (error: unknown) {
    console.error("EC2 API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch EC2 data" }, { status: 500 });
  }
}
