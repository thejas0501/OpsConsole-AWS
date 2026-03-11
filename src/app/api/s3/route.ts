import { NextResponse } from "next/server";
import { getS3Client, getCloudWatchClient } from "@/lib/aws-clients";
import { ListBucketsCommand, GetBucketLocationCommand, GetBucketVersioningCommand, GetBucketEncryptionCommand, GetBucketLifecycleConfigurationCommand, GetBucketTaggingCommand } from "@aws-sdk/client-s3";
import { GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    
    // We use a default region client to list buckets, 
    // but the locations could be anywhere.
    const s3 = getS3Client(region);

    const listCmd = new ListBucketsCommand({});
    const bucketsRes = await s3.send(listCmd);

    const results: Record<string, unknown>[] = [];
    const endTime = new Date();
    const startTime24h = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    for (const b of (bucketsRes.Buckets || [])) {
        const name = b.Name!;
        
        let bucketRegion = "unknown";
        let versioning = "unknown";
        let encryption = "unknown";
        let lifecycle = "unknown";
        let tags = "unknown";
        let sizeBytes = 0;
        let numObjects = 0;

        try {
            const locCmd = new GetBucketLocationCommand({ Bucket: name });
            const locRes = await s3.send(locCmd);
            bucketRegion = locRes.LocationConstraint || "us-east-1";
        } catch (e) {
            // ignore access denied
        }

        try {
           const verCmd = new GetBucketVersioningCommand({ Bucket: name });
           const verRes = await s3.send(verCmd);
           versioning = verRes.Status || "Suspended/NotEnabled";
        } catch (e) {}

        try {
            const encCmd = new GetBucketEncryptionCommand({ Bucket: name });
            await s3.send(encCmd);
            encryption = "Enabled";
        } catch (e) {
            encryption = "Disabled/Denied";
        }
        
        try {
            const lcCmd = new GetBucketLifecycleConfigurationCommand({ Bucket: name });
            await s3.send(lcCmd);
            lifecycle = "Configured";
        } catch (e) {
            lifecycle = "None/Denied";
        }
        
        try {
            const tagsCmd = new GetBucketTaggingCommand({ Bucket: name });
            const tagsRes = await s3.send(tagsCmd);
            tags = (tagsRes.TagSet || []).map((t: any) => `${String(t.Key)}=${String(t.Value)}`).join(", ") || "None";
        } catch {
            tags = "Denied/None";
        }

        // Metrics (StorageType=StandardStorage)
        try {
           const cwBucket = getCloudWatchClient(bucketRegion !== "unknown" ? bucketRegion : region);
           
           const sizeCmd = new GetMetricStatisticsCommand({
               Namespace: "AWS/S3", MetricName: "BucketSizeBytes",
               Dimensions: [{ Name: "BucketName", Value: name }, { Name: "StorageType", Value: "StandardStorage" }],
               StartTime: startTime24h, EndTime: endTime, Period: 86400, Statistics: ["Maximum"]
           });
           const sizeRes = await cwBucket.send(sizeCmd);
           sizeBytes = sizeRes.Datapoints?.[0]?.Maximum || 0;

           const objCmd = new GetMetricStatisticsCommand({
               Namespace: "AWS/S3", MetricName: "NumberOfObjects",
               Dimensions: [{ Name: "BucketName", Value: name }, { Name: "StorageType", Value: "AllStorageTypes" }],
               StartTime: startTime24h, EndTime: endTime, Period: 86400, Statistics: ["Maximum"]
           });
           const objRes = await cwBucket.send(objCmd);
           numObjects = objRes.Datapoints?.[0]?.Maximum || 0;

        } catch (e) {
           console.warn("CW Error for bucket", name, e);
        }

        results.push({
            Name: name,
            CreationDate: b.CreationDate,
            Region: bucketRegion,
            Versioning: versioning,
            Encryption: encryption,
            Lifecycle: lifecycle,
            Tags: tags,
            SizeBytes: sizeBytes,
            NumObjects: numObjects
        });
    }

    return NextResponse.json(results);
  } catch (error: unknown) {
    console.error("S3 API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
