import { CostExplorerClient } from "@aws-sdk/client-cost-explorer";
import { ECSClient } from "@aws-sdk/client-ecs";
import { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import { RDSClient } from "@aws-sdk/client-rds";
import { EC2Client } from "@aws-sdk/client-ec2";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { LambdaClient } from "@aws-sdk/client-lambda";

// Load credentials from environment (Next.js automatically loads .env files)
const getAwsConfig = (region?: string) => {
  return {
    region: region || process.env.AWS_DEFAULT_REGION || "ap-south-1",
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
    } : undefined,
  };
};

// Cost Explorer is a global service and requires us-east-1 endpoint
export const getCostExplorerClient = () => new CostExplorerClient(getAwsConfig("us-east-1"));

export const getEcsClient = (region?: string) => new ECSClient(getAwsConfig(region));
export const getElbClient = (region?: string) => new ElasticLoadBalancingV2Client(getAwsConfig(region));
export const getRdsClient = (region?: string) => new RDSClient(getAwsConfig(region));
export const getEc2Client = (region?: string) => new EC2Client(getAwsConfig(region));
export const getS3Client = (region?: string) => new S3Client(getAwsConfig(region));
export const getCloudWatchClient = (region?: string) => new CloudWatchClient(getAwsConfig(region));
export const getLambdaClient = (region?: string) => new LambdaClient(getAwsConfig(region));
