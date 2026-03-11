# AWS Ops Console (Next.js Dashboard)

A robust, premium, read-only Next.js dashboard for monitoring AWS costs, resource health, and tracking cloud waste/idle resources. Inspired by premium Operations Consoles.

## Disclaimer on Security & Auth
This dashboard is strictly **READ-ONLY**. 
The backend only utilizes `@aws-sdk/client-*` APIs that start with `List`, `Describe`, or `Get`. 
**Authentication is handled via environment variables only.** Do not commit your `.env.local` to GitHub.

## Features
- **Cost Monitoring**: Fast, localized overview of your top spending services.
- **RDS Databases**: Precise health, CPU %, free storage %, and maximum connections over 24h.
- **ECS Clusters**: Real-time evaluation of Fargate/EC2 desired vs running tasks and failing deployments.
- **Load Balancers**: High 5XX error rate detection and 0-healthy Target Group tracking.
- **Waste & Idle Detection**: Unused EIPs, unattached EBS volumes, and EC2 instances averaging < 5% CPU over 7 days.
- **S3 Storage**: Bucket inventory, encryption/versioning posture, and precise sizes.

## Setup Instructions

1. **Install Dependencies**:
```bash
npm install
```

2. **Configure AWS Credentials**:
Copy the example environment file:
```bash
cp .env.example .env.local
```
Fill in `.env.local` with an IAM user that has read permissions (e.g. `ViewOnlyAccess` + `ce:GetCostAndUsage`).

3. **Run the Development Server**:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Technology Stack
- **Framework**: Next.js 15 (App Router, Server API Routes)
- **Styling**: Tailwind CSS & Lucide React icons
- **AWS**: AWS SDK for JavaScript v3

## Notes on Cost Explorer accuracy
Cost Explorer data can be delayed by AWS by up to 24-48 hours. The UI shows a simulated total cost purely for visual completeness of the provided Ops Console design; the actual AWS Cost Explorer data powers the `/api/cost` route.
