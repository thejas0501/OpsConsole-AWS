import { NextResponse } from "next/server";
import { EC2Client, DescribeSecurityGroupsCommand, DescribeVpcsCommand } from "@aws-sdk/client-ec2";
import { IAMClient, ListUsersCommand, GetAccountSummaryCommand } from "@aws-sdk/client-iam";

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

function getIamClient() {
  return new IAMClient({
    region: "us-east-1",
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
    const iam = getIamClient();

    // Security groups
    const sgRes = await ec2.send(new DescribeSecurityGroupsCommand({}));
    const securityGroups = (sgRes.SecurityGroups || []).map((sg: any) => {
      const openPorts = (sg.IpPermissions || []).flatMap((p: any) =>
        (p.IpRanges || []).filter((r: any) => r.CidrIp === "0.0.0.0/0").map(() => p.FromPort)
      );
      return {
        GroupId: sg.GroupId,
        GroupName: sg.GroupName,
        VpcId: sg.VpcId,
        Description: sg.Description,
        OpenToInternet: openPorts.length > 0,
        OpenPorts: [...new Set(openPorts)],
        InboundRules: (sg.IpPermissions || []).length,
      };
    });

    // VPCs
    const vpcRes = await ec2.send(new DescribeVpcsCommand({}));
    const vpcs = (vpcRes.Vpcs || []).map((v: any) => ({
      VpcId: v.VpcId,
      CidrBlock: v.CidrBlock,
      IsDefault: v.IsDefault,
      State: v.State,
      Name: (v.Tags || []).find((t: any) => t.Key === "Name")?.Value || v.VpcId,
    }));

    // IAM Summary
    let iamSummary: Record<string, unknown> = {};
    let users: Record<string, unknown>[] = [];
    try {
      const [summaryRes, usersRes] = await Promise.all([
        iam.send(new GetAccountSummaryCommand({})),
        iam.send(new ListUsersCommand({ MaxItems: 50 })),
      ]);
      iamSummary = {
        Users: summaryRes.SummaryMap?.Users,
        Groups: summaryRes.SummaryMap?.Groups,
        Roles: summaryRes.SummaryMap?.Roles,
        Policies: summaryRes.SummaryMap?.Policies,
        MFADevices: summaryRes.SummaryMap?.MFADevices,
        AccountMFAEnabled: summaryRes.SummaryMap?.AccountMFAEnabled,
      };
      users = (usersRes.Users || []).map((u: any) => ({
        UserName: u.UserName,
        UserId: u.UserId,
        CreateDate: u.CreateDate,
        PasswordLastUsed: u.PasswordLastUsed,
      }));
    } catch (e) {
      console.warn("IAM fetch skipped:", e);
    }

    const riskyGroups = securityGroups.filter((sg: any) => sg.OpenToInternet);

    return NextResponse.json({
      securityGroups,
      riskyGroups,
      vpcs,
      iamSummary,
      users,
      summary: {
        totalSGs: securityGroups.length,
        riskySGs: riskyGroups.length,
        totalVpcs: vpcs.length,
      }
    });
  } catch (error: unknown) {
    console.error("Security API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch security data" }, { status: 500 });
  }
}
