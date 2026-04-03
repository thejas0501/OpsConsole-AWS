import { NextResponse } from "next/server";
import { EC2Client, DescribeSecurityGroupsCommand, DescribeVpcsCommand } from "@aws-sdk/client-ec2";
import {
  IAMClient,
  ListUsersCommand,
  GetAccountSummaryCommand,
  ListAttachedUserPoliciesCommand,
  ListUserPoliciesCommand,
  ListGroupsForUserCommand,
  ListAttachedGroupPoliciesCommand,
} from "@aws-sdk/client-iam";

const HIGH_PRIV_POLICIES = [
  "AdministratorAccess",
  "PowerUserAccess",
  "IAMFullAccess",
  "SecurityAudit",
  "AWSAccountManagementFullAccess",
  "AWSAdministratorAccess",
];

const ADMIN_POLICIES = ["AdministratorAccess", "AWSAdministratorAccess"];
const POWER_POLICIES = ["PowerUserAccess", "AWSAccountManagementFullAccess", "IAMFullAccess"];

function classifyPolicy(policyName: string): "ADMIN" | "POWER" | "ELEVATED" {
  if (ADMIN_POLICIES.some(p => policyName.includes(p))) return "ADMIN";
  if (POWER_POLICIES.some(p => policyName.includes(p))) return "POWER";
  return "ELEVATED";
}

function getCredentials() {
  return process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
    sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
  } : undefined;
}

function getEc2Client(region?: string) {
  return new EC2Client({
    region: region || process.env.AWS_DEFAULT_REGION || "ap-south-1",
    credentials: getCredentials(),
  });
}

function getIamClient() {
  return new IAMClient({
    region: "us-east-1",
    credentials: getCredentials(),
  });
}

// Determine port severity level
function getPortSeverity(port: number | null | undefined): "CRITICAL" | "HIGH" | "MEDIUM" {
  if (port === null || port === undefined) return "CRITICAL"; // All traffic
  const criticalPorts = [22, 3389, 3306, 5432, 27017, 6379, 2181];
  const highPorts = [80, 443, 8080, 8443, 8888];
  if (criticalPorts.includes(port)) return "CRITICAL";
  if (highPorts.includes(port)) return "HIGH";
  return "MEDIUM";
}

function getGroupSeverity(openPorts: (number | null | undefined)[]): "CRITICAL" | "HIGH" | "MEDIUM" {
  if (openPorts.length === 0) return "MEDIUM";
  for (const p of openPorts) {
    if (getPortSeverity(p) === "CRITICAL") return "CRITICAL";
  }
  for (const p of openPorts) {
    if (getPortSeverity(p) === "HIGH") return "HIGH";
  }
  return "MEDIUM";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    const ec2 = getEc2Client(region);
    const iam = getIamClient();

    // ── Security Groups ─────────────────────────────────────────────────
    const sgRes = await ec2.send(new DescribeSecurityGroupsCommand({}));
    const securityGroups = (sgRes.SecurityGroups || []).map((sg: any) => {
      const openPorts: (number | null)[] = (sg.IpPermissions || []).flatMap((p: any) => {
        const hasPublic = (p.IpRanges || []).some((r: any) => r.CidrIp === "0.0.0.0/0") ||
          (p.Ipv6Ranges || []).some((r: any) => r.CidrIpv6 === "::/0");
        if (!hasPublic) return [] as (number | null)[];
        const port: number | null = typeof p.FromPort === "number" ? p.FromPort : null;
        return [port];
      });

      const uniquePorts: (number | null)[] = [...new Set(openPorts)];
      const severity = getGroupSeverity(uniquePorts);

      return {
        GroupId: sg.GroupId,
        GroupName: sg.GroupName,
        VpcId: sg.VpcId,
        Description: sg.Description,
        OpenToInternet: openPorts.length > 0,
        OpenPorts: uniquePorts,
        Severity: severity,
        InboundRules: (sg.IpPermissions || []).length,
      };
    });

    // ── VPCs ──────────────────────────────────────────────────────────────
    const vpcRes = await ec2.send(new DescribeVpcsCommand({}));
    // Build a map of VpcId → Name for display
    const vpcMap: Record<string, string> = {};
    const vpcs = (vpcRes.Vpcs || []).map((v: any) => {
      const name = (v.Tags || []).find((t: any) => t.Key === "Name")?.Value || v.VpcId;
      vpcMap[v.VpcId] = name;
      return {
        VpcId: v.VpcId,
        CidrBlock: v.CidrBlock,
        IsDefault: v.IsDefault,
        State: v.State,
        Name: name,
      };
    });

    // Enrich security groups with VPC names
    const enrichedSgs = securityGroups.map(sg => ({
      ...sg,
      VpcName: vpcMap[sg.VpcId || ""] || sg.VpcId || "—",
    }));

    // ── IAM ────────────────────────────────────────────────────────────────
    let iamSummary: Record<string, unknown> = {};
    let users: Record<string, unknown>[] = [];
    let highPrivUsers: Record<string, unknown>[] = [];

    try {
      const [summaryRes, usersRes] = await Promise.all([
        iam.send(new GetAccountSummaryCommand({})),
        iam.send(new ListUsersCommand({ MaxItems: 100 })),
      ]);

      iamSummary = {
        Users: summaryRes.SummaryMap?.Users,
        Groups: summaryRes.SummaryMap?.Groups,
        Roles: summaryRes.SummaryMap?.Roles,
        Policies: summaryRes.SummaryMap?.Policies,
        MFADevices: summaryRes.SummaryMap?.MFADevices,
        AccountMFAEnabled: summaryRes.SummaryMap?.AccountMFAEnabled,
      };

      // Enrich each user with their attached policies + group policies
      const enrichedUsers = await Promise.all(
        (usersRes.Users || []).map(async (u: any) => {
          const allPolicies: { name: string; type: "inline" | "managed" | "group"; severity: "ADMIN" | "POWER" | "ELEVATED" }[] = [];

          try {
            // Directly attached managed policies
            const attached = await iam.send(new ListAttachedUserPoliciesCommand({ UserName: u.UserName }));
            for (const p of attached.AttachedPolicies || []) {
              const name = p.PolicyName || "";
              if (HIGH_PRIV_POLICIES.some(hp => name.includes(hp)) || name.includes("FullAccess") || name.includes("Admin")) {
                allPolicies.push({ name, type: "managed", severity: classifyPolicy(name) });
              }
            }

            // Inline policies
            const inline = await iam.send(new ListUserPoliciesCommand({ UserName: u.UserName }));
            for (const name of inline.PolicyNames || []) {
              allPolicies.push({ name, type: "inline", severity: classifyPolicy(name) });
            }

            // Group-inherited policies
            const groups = await iam.send(new ListGroupsForUserCommand({ UserName: u.UserName }));
            for (const g of groups.Groups || []) {
              const groupPolicies = await iam.send(new ListAttachedGroupPoliciesCommand({ GroupName: g.GroupName! }));
              for (const p of groupPolicies.AttachedPolicies || []) {
                const name = p.PolicyName || "";
                if (HIGH_PRIV_POLICIES.some(hp => name.includes(hp)) || name.includes("FullAccess") || name.includes("Admin")) {
                  allPolicies.push({ name: `[via ${g.GroupName}] ${name}`, type: "group", severity: classifyPolicy(name) });
                }
              }
            }
          } catch (e) {
            console.warn("Policy fetch error for user", u.UserName, e);
          }

          const isHighPriv = allPolicies.length > 0;
          const topSeverity = allPolicies.some(p => p.severity === "ADMIN")
            ? "ADMIN"
            : allPolicies.some(p => p.severity === "POWER")
            ? "POWER"
            : allPolicies.length > 0
            ? "ELEVATED"
            : null;

          return {
            UserName: u.UserName,
            UserId: u.UserId,
            CreateDate: u.CreateDate,
            PasswordLastUsed: u.PasswordLastUsed || null,
            IsHighPriv: isHighPriv,
            TopSeverity: topSeverity,
            Policies: allPolicies,
          };
        })
      );

      users = enrichedUsers;
      highPrivUsers = enrichedUsers.filter((u: any) => u.IsHighPriv);
    } catch (e) {
      console.warn("IAM fetch skipped:", e);
    }

    const riskyGroups = enrichedSgs.filter((sg: any) => sg.OpenToInternet);

    return NextResponse.json({
      securityGroups: enrichedSgs,
      riskyGroups,
      vpcs,
      iamSummary,
      users,
      highPrivUsers,
      summary: {
        totalSGs: enrichedSgs.length,
        riskySGs: riskyGroups.length,
        criticalSGs: riskyGroups.filter((sg: any) => sg.Severity === "CRITICAL").length,
        highSGs: riskyGroups.filter((sg: any) => sg.Severity === "HIGH").length,
        mediumSGs: riskyGroups.filter((sg: any) => sg.Severity === "MEDIUM").length,
        totalVpcs: vpcs.length,
        adminUsers: highPrivUsers.filter((u: any) => u.TopSeverity === "ADMIN").length,
        powerUsers: highPrivUsers.filter((u: any) => u.TopSeverity === "POWER").length,
      }
    });
  } catch (error: unknown) {
    console.error("Security API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch security data" },
      { status: 500 }
    );
  }
}
