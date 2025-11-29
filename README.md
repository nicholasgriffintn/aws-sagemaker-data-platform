# AWS ML Platform - Unified SageMaker Infrastructure

A modular AWS SageMaker platform that provides shared infrastructure for multiple ML pipelines that I'm testing out to learn more about Sagemaker and related systems on AWS.

Currently this includes:

- **Experiment Bucketing Pipeline** - Experiment bucketing with preprocessing, training, and inference
- **ML Experiment Recommender** - Recommendation engine for suggesting experiments using historical uplift data

```
┌─────────────────────────────────────────────────────────┐
│                  ML Pipeline Layer                       │
│  ┌──────────────────┐      ┌──────────────────────┐    │
│  │  Experiment      │      │   Recommender        │    │
│  │  Bucketing       │      │   Pipeline           │    │
│  │  Pipeline        │      │                      │    │
│  └──────────────────┘      └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│            Shared Infrastructure Layer                   │
│  Network │ IAM │ Storage │ Glue │ Lake Formation │      │
│  SageMaker Studio │ Code Deployment                     │
└─────────────────────────────────────────────────────────┘
```

## Usage

### For Experiment Bucketing Pipeline

1. Upload raw experiment data via data ingestion Lambda
2. SageMaker pipeline automatically runs preprocessing, training, evaluation
3. Deploy endpoint for real-time bucketing predictions

### For ML Recommender Pipeline

1. Upload historical experiment data to `s3://bucket/raw/experiments/`
2. Run Glue crawlers to catalog data
3. Run Glue ETL job to generate features
4. Train model locally using `recommender-pipeline/train.py`
5. Package and upload model to S3
6. Deploy SageMaker endpoint
7. Call recommender API to get experiment suggestions

## Environment Configuration

The platform uses environment-based JSON configuration files in `config/environments/`:

```json
{
  "componentName": "aws-ml-platform",
  "awsAccount": "YOUR_ACCOUNT_ID",
  "awsRegion": "eu-west-1",
  "private": false
}
```

- `componentName` - Prefix for all resource names
- `awsAccount` - AWS account ID
- `awsRegion` - AWS region
- `private` - Whether to use private subnets only (true for production)

## Installation

```bash
pnpm install
```

## Deployment

### 1. Configure Environment

Edit `config/environments/dev.json` with your AWS account details.

### 2. Build

```bash
pnpm run build
```

### 3. Synthesize CloudFormation

```bash
pnpm run synth
```

### 4. Deploy

Deploy all stacks:

```bash
pnpm run deploy
```

Or deploy specific stacks:

```bash
pnpm run cdk deploy aws-ml-platform-Network-dev aws-ml-platform-Storage-dev
```

### 5. Deploy to Different Environments

```bash
# Production
pnpm run cdk synth -c env=prod
pnpm run cdk deploy -c env=prod --all
```

## Adding New ML Pipelines

To add a new ML pipeline:

1. Create a new stack in `cdk/lib/stacks/pipelines/your-pipeline-stack.ts`
2. Import and instantiate it in `cdk/bin/cdk.ts` under the "ML Pipeline Layer" section
3. Use the shared infrastructure resources (storage, IAM roles, network, etc.)
4. Add appropriate dependencies

Example:

```typescript
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
