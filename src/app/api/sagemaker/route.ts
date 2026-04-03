import { NextResponse } from "next/server";
import {
  SageMakerClient,
  ListEndpointsCommand,
  ListNotebookInstancesCommand,
} from "@aws-sdk/client-sagemaker";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || process.env.AWS_DEFAULT_REGION || "ap-south-1";

    const sm = new SageMakerClient({ region });

    // Paginate endpoints
    const endpoints: Record<string, unknown>[] = [];
    let nextToken: string | undefined;
    do {
      const res = await sm.send(new ListEndpointsCommand({ NextToken: nextToken, MaxResults: 100 }));
      for (const e of res.Endpoints || []) {
        endpoints.push({
          EndpointName: e.EndpointName,
          EndpointStatus: e.EndpointStatus,
          CreationTime: e.CreationTime?.toISOString(),
          LastModifiedTime: e.LastModifiedTime?.toISOString(),
        });
      }
      nextToken = res.NextToken;
    } while (nextToken);

    // Paginate notebook instances
    const notebooks: Record<string, unknown>[] = [];
    let nbToken: string | undefined;
    do {
      const res = await sm.send(new ListNotebookInstancesCommand({ NextToken: nbToken, MaxResults: 100 }));
      for (const n of res.NotebookInstances || []) {
        notebooks.push({
          NotebookInstanceName: n.NotebookInstanceName,
          NotebookInstanceStatus: n.NotebookInstanceStatus,
          InstanceType: n.InstanceType,
          CreationTime: n.CreationTime?.toISOString(),
          LastModifiedTime: n.LastModifiedTime?.toISOString(),
        });
      }
      nbToken = res.NextToken;
    } while (nbToken);

    return NextResponse.json({ endpoints, notebooks });
  } catch (error: unknown) {
    console.error("SageMaker API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch SageMaker data" }, { status: 500 });
  }
}
