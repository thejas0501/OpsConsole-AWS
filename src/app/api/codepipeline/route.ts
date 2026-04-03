import { NextResponse } from "next/server";
import {
  CodePipelineClient,
  ListPipelinesCommand,
  GetPipelineStateCommand,
} from "@aws-sdk/client-codepipeline";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || process.env.AWS_DEFAULT_REGION || "ap-south-1";

    const cp = new CodePipelineClient({ region });
    const pipelines: Record<string, unknown>[] = [];

    let nextToken: string | undefined;
    do {
      const res = await cp.send(new ListPipelinesCommand({ nextToken }));
      const items = res.pipelines || [];

      // Enrich with pipeline state (latest execution)
      await Promise.all(
        items.map(async (p) => {
          try {
            const state = await cp.send(new GetPipelineStateCommand({ name: p.name! }));
            const latest = state.stageStates?.[0]?.latestExecution;
            pipelines.push({
              Name: p.name,
              Created: p.created?.toISOString(),
              Updated: p.updated?.toISOString(),
              LastExecutionStatus: latest?.status,
              LastExecutionTime: latest?.lastStatusChange?.toISOString(),
            });
          } catch {
            pipelines.push({ Name: p.name, Created: p.created?.toISOString(), Updated: p.updated?.toISOString() });
          }
        })
      );

      nextToken = res.nextToken;
    } while (nextToken);

    return NextResponse.json(pipelines);
  } catch (error: unknown) {
    console.error("CodePipeline API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch CodePipeline data" }, { status: 500 });
  }
}
