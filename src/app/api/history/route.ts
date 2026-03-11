import { NextResponse } from "next/server";
import { CloudTrailClient, LookupEventsCommand } from "@aws-sdk/client-cloudtrail";

function getCreds() {
  if (!process.env.AWS_ACCESS_KEY_ID) return undefined;
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
    sessionToken: process.env.AWS_SESSION_TOKEN?.trim(),
  };
}

function getRegion(r?: string | null) { return r || process.env.AWS_DEFAULT_REGION || "ap-south-1"; }

// Map AWS API events to user-friendly reasons and recovery steps
const recoveryMap: Record<string, { reason: string; severity: "critical" | "warning" | "info"; recovery: string[] }> = {
  "StopInstances": {
    reason: "Instance was manually stopped or stopped via an automation script.",
    severity: "warning",
    recovery: ["Verify if the instance was stopped intentionally (e.g., cost saving).", "Start the instance via the AWS Console or CLI if needed.", "If unintended, check IAM permissions of the user who stopped it."],
  },
  "TerminateInstances": {
    reason: "Instance was permanently terminated.",
    severity: "critical",
    recovery: ["Terminated instances cannot be recovered directly.", "Restore from the latest AMI snapshot.", "Review Auto Scaling Group rules if this was triggered automatically."],
  },
  "RebootInstances": {
    reason: "Instance was rebooted.",
    severity: "info",
    recovery: ["Check application health once the instance comes back online.", "Verify if the reboot was scheduled for OS patching.", "Review application logs for unexpected crashes prior to reboot."],
  },
  "DeleteDBInstance": {
    reason: "RDS Database instance was deleted.",
    severity: "critical",
    recovery: ["Restore from the final DB snapshot immediately if this was a production database.", "Update application connection strings if restoring to a new instance."],
  },
  "StopDBInstance": {
    reason: "RDS Database was temporarily stopped.",
    severity: "warning",
    recovery: ["RDS instances automatically restart after 7 days.", "Manually start the DB instance from the RDS console if needed immediately."],
  },
  "RebootDBInstance": {
    reason: "RDS Database was rebooted, possibly for maintenance or parameter group changes.",
    severity: "info",
    recovery: ["Ensure the application correctly reconnected to the database.", "Check RDS events for any forced maintenance windows."],
  },
  "StartInstances": {
    reason: "Instance was manually started.",
    severity: "info",
    recovery: ["Monitor the instance to ensure it passes all status checks.", "Verify that hosted applications have started successfully."],
  },
  "StopTask": {
    reason: "ECS Container task was stopped.",
    severity: "warning",
    recovery: ["Container may have crashed or was stopped manually.", "Check ECS Task logs (CloudWatch) for exit codes (e.g., 137 = OOM Killed).", "If part of a Service, ECS should auto-restart a replacement task."],
  },
  "DeregisterContainerInstance": {
    reason: "ECS container instance was deregistered from the cluster.",
    severity: "critical",
    recovery: ["Verify if the underlying EC2 instance was terminated.", "Check the ECS agent logs on the instance if it's still running.", "Scale out the Auto Scaling Group if cluster capacity is low."],
  }
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = getRegion(searchParams.get("region"));
    const creds = getCreds();
    if (!creds) {
       return NextResponse.json({ error: "AWS credentials not found in environment." }, { status: 401 });
    }

    const ct = new CloudTrailClient({ region, credentials: creds });

    // Look back 7 days
    const StartTime = new Date();
    StartTime.setDate(StartTime.getDate() - 7);
    const EndTime = new Date();

    // Target specific state-altering events
    const targetEvents = Object.keys(recoveryMap);

    const history: any[] = [];
    
    // CloudTrail LookupEvents only supports a single lookup attribute per query.
    // If we only query `ReadOnly=false`, older events get pushed out in busy accounts.
    // Here we sequentially query precise EventNames. (Sequential avoids AWS 2 TPS rate limit).
    
    for (const eventName of targetEvents) {
      try {
        const command = new LookupEventsCommand({
          StartTime,
          EndTime,
          LookupAttributes: [
            { AttributeKey: "EventName", AttributeValue: eventName }
          ],
          MaxResults: 50
        });

        const ctRes = await ct.send(command);

        for (const event of (ctRes.Events || [])) {
          // Try to parse the CloudTrail event JSON
          let eventDetail: any = {};
          try {
            if (event.CloudTrailEvent) {
               eventDetail = JSON.parse(event.CloudTrailEvent);
            }
          } catch { /* ignore parse errors */ }

          // Find primary resource
          const resource = (event.Resources || [])[0];
          const resourceId = resource?.ResourceName || "Unknown Resource";
          let resourceType = resource?.ResourceType || "Unknown Type";
          
          if (resourceType === "Unknown Type" && eventName.includes("Instance")) {
            resourceType = "AWS::EC2::Instance";
          }

          let errorMsg = undefined;
          if (eventDetail.errorCode || eventDetail.errorMessage) {
             errorMsg = `${eventDetail.errorCode || ''}: ${eventDetail.errorMessage || ''}`;
          }

          const mapping = recoveryMap[eventName];

          history.push({
            eventId: event.EventId,
            timestamp: event.EventTime,
            eventName: event.EventName,
            resourceId: resourceId,
            resourceType: resourceType,
            username: event.Username,
            sourceIp: eventDetail.sourceIPAddress,
            severity: errorMsg ? "critical" : mapping.severity,
            reason: errorMsg ? `Failed Action: ${errorMsg}` : mapping.reason,
            recoverySteps: mapping.recovery,
            hasError: !!errorMsg
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch CloudTrail for ${eventName}:`, err);
      }
    }

    // Sort descending by time
    history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ history });

  } catch (error: unknown) {
    console.error("History API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch cloudtrail history" }, { status: 500 });
  }
}
