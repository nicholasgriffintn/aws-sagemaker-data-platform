# AWS ML Platform

A modular AWS SageMaker platform that provides shared infrastructure for multiple ML pipelines that I'm testing out to learn more about Sagemaker and related systems on AWS.

## Overview

- **Experiment Bucketing Pipeline** - Experiment bucketing with preprocessing, training, and inference
- **ML Experiment Recommender** - Recommendation engine for suggesting experiments using historical uplift data

```
┌─────────────────────────────────────────────────────────────────┐
│                       ML Pipeline Layer                          │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐ │
│  │  Experiment Bucketing   │    │   Recommender Pipeline      │ │
│  │  ├─ Data Ingestion λ    │    │   ├─ Glue ETL Job           │ │
│  │  ├─ SageMaker Pipeline  │    │   ├─ Glue Crawlers          │ │
│  │  ├─ Training Job        │    │   ├─ SageMaker Endpoint     │ │
│  │  └─ Inference Endpoint  │    │   └─ API Gateway + Lambda   │ │
│  └─────────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Shared Infrastructure Layer                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Network  │ │   IAM    │ │ Storage  │ │ Lake Formation     │  │
│  │ (VPC)    │ │ (Roles)  │ │ (S3+KMS) │ │ (Data Governance)  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────────────────────┐  │
│  │   Glue   │ │ SageMaker│ │       Code Deployment           │  │
│  │ (Catalog)│ │  Studio  │ │      (S3 Scripts Sync)          │  │
│  └──────────┘ └──────────┘ └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** >= 22.10.0
- **pnpm** (package manager)
- **Python** >= 3.10
- **AWS CLI** configured with appropriate credentials
- **AWS CDK** CLI (`pnpm add -g aws-cdk`)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
pip install -r glue/requirements.txt
pip install -r sagemaker-scripts/experiment-pipeline/requirements.txt
pip install -r sagemaker-scripts/recommender-pipeline/requirements.txt
```

Or use the Makefile:

```bash
make install
```

### 2. Configure Environment

Edit `config/environments/dev.json` with your AWS account details:

```json
{
  "componentName": "aws-ml-platform",
  "awsAccount": "YOUR_ACCOUNT_ID",
  "awsRegion": "eu-west-1",
  "private": false
}
```

| Property | Description |
|----------|-------------|
| `componentName` | Prefix for all resource names |
| `awsAccount` | Your AWS account ID |
| `awsRegion` | Target AWS region |
| `private` | `true` for private subnets only (production), `false` for public access (development) |

### 3. Build and Deploy

```bash
# Build TypeScript
pnpm run build

# Preview changes
pnpm run diff

# Deploy all stacks
pnpm run deploy
```

Or deploy specific stacks:

```bash
pnpm run cdk deploy aws-ml-platform-Network-dev aws-ml-platform-Storage-dev
```

### 4. Deploy to Production

```bash
pnpm run cdk synth -c env=prod
pnpm run cdk deploy -c env=prod --all
```

## Usage

### Experiment Bucketing Pipeline

1. **Ingest Data**: Upload raw experiment data via the data ingestion Lambda (scheduled daily at 2am UTC)
2. **Run Pipeline**: SageMaker pipeline automatically runs preprocessing, training, and evaluation
3. **Deploy Model**: Approved models are registered and the endpoint is updated
4. **Make Predictions**: Call the real-time endpoint for user bucketing

### ML Recommender Pipeline

1. **Generate Data**: `make generate-data` creates synthetic experiment data
2. **Upload Data**: `make upload-data BUCKET=your-bucket` syncs to S3
3. **Catalog Data**: Glue crawlers run hourly to catalog raw data
4. **Run ETL**: `make etl` runs the feature engineering job
5. **Train Model**: `make train` preprocesses and trains locally
6. **Deploy Model**: `make package-model && make upload-model` deploys to SageMaker
7. **Get Recommendations**: POST to `/recommend` endpoint with a goal

Example API request:

```bash
curl -X POST https://YOUR_API_GATEWAY_URL/recommend \
  -H "Content-Type: application/json" \
  -d '{"goal": "increase live news at 18:00 for 16-25s", "top_n": 5}'
```

## Adding New ML Pipelines

To add a new ML pipeline:

1. Create a new stack in `cdk/lib/stacks/pipelines/your-pipeline-stack.ts`
2. Import and instantiate it in `cdk/bin/cdk.ts` under the "ML Pipeline Layer" section
3. Use shared infrastructure resources (storage, IAM roles, network, etc.)
4. Add appropriate dependencies

Example:

```typescript
import { YourPipelineStack } from '../lib/stacks/pipelines/your-pipeline-stack';

const yourPipeline = new YourPipelineStack(
  app,
  `${cfg.componentName}-YourPipeline-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    processedDataBucket: storage.processedDataBucket,
    sagemakerExecutionRole: iam.sagemakerExecutionRole,
    // ... other shared resources
  }
);
yourPipeline.addDependency(lakeFormation);
```
