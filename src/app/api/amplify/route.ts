import { NextResponse } from "next/server";
import {
  AmplifyClient,
  ListAppsCommand,
} from "@aws-sdk/client-amplify";

export async function GET() {
  try {
    // Amplify is region-specific but commonly us-east-1; use the default credential chain region
    const amplify = new AmplifyClient({ region: process.env.AWS_DEFAULT_REGION || "ap-south-1" });
    const apps: Record<string, unknown>[] = [];
    let nextToken: string | undefined;

    do {
      const res = await amplify.send(new ListAppsCommand({ nextToken, maxResults: 100 }));
      for (const app of res.apps || []) {
        apps.push({
          AppId: app.appId,
          Name: app.name,
          DefaultDomain: app.defaultDomain,
          Repository: app.repository,
          Platform: app.platform,
          CreateTime: app.createTime?.toISOString(),
          UpdateTime: app.updateTime?.toISOString(),
          ProductionBranch: app.productionBranch?.branchName,
        });
      }
      nextToken = res.nextToken;
    } while (nextToken);

    return NextResponse.json(apps);
  } catch (error: unknown) {
    console.error("Amplify API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch Amplify data" }, { status: 500 });
  }
}
