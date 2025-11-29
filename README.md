# AWS ML Platform

A modular AWS SageMaker platform that provides shared infrastructure for multiple ML pipelines that I'm testing out to learn more about Sagemaker and related systems on AWS.

## Overview

- **User Bucketing Pipeline** - Classifies users for experiment assignment using SageMaker pipelines
- **ML Recommender Pipeline** - Recommendation engine for suggesting experiments using historical uplift data

```
┌─────────────────────────────────────────────────────────────────┐
│                       ML Pipeline Layer                          │
│  ┌─────────────────────────┐    ┌─────────────────────────────┐ │
│  │   Bucketing Pipeline    │    │   Recommender Pipeline      │ │
│  │  ├─ SageMaker Pipeline  │    │   ├─ SageMaker Pipeline     │ │
│  │  ├─ Inference Endpoint  │    │   ├─ Inference Endpoint     │ │
│  │  └─ API Gateway + Lambda│    │   └─ API Gateway + Lambda   │ │
│  └─────────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Feature Infrastructure Layer                     │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │ DynamoDB             │    │ SageMaker Feature Store      │   │
│  │ (Real-time Features) │    │ (ML-optimized Features)      │   │
│  └──────────────────────┘    └──────────────────────────────┘   │
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
make install
```

Or manually:

```bash
pnpm install
pip install -r data-generator/requirements.txt
pip install -r sagemaker-scripts/bucketing-pipeline/requirements.txt
pip install -r sagemaker-scripts/recommender-pipeline/requirements.txt
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

## Data Generation

Both pipelines use the unified `data-generator` tool:

```bash
# Generate all data locally
make generate-data

# Generate specific data types
make generate-experiment   # Experiment metadata for recommender
make generate-bucketing    # User data for bucketing

# Generate and upload to S3
make upload-data BUCKET=your-bucket-name
```

Or use the CLI directly:

```bash
cd data-generator
python main.py all                              # Generate both datasets
python main.py experiment --records 100000     # Generate 100k experiments
python main.py bucketing --records 50000       # Generate 50k users
python main.py all --upload --bucket my-bucket # Generate and upload to S3
```

## Usage

### User Bucketing Pipeline

1. **Generate Data**: `make generate-bucketing` creates synthetic user data
2. **Upload Data**: `make upload-bucketing-data BUCKET=your-bucket`
3. **Run Pipeline**: SageMaker pipeline runs preprocessing, training, and evaluation
4. **Deploy Model**: Approved models are registered and the endpoint is updated
5. **Bucket Users**: POST to `/bucket` endpoint with a user ID

Example:

```typescript
// On user login/page load
const response = await fetch('/bucket', {
  method: 'POST',
  body: JSON.stringify({ user_id: userId })
});

/**
 * Example response:
 * {
    "goal": "increase live news at 18:00 for 16-25s",
    "parsed": {
      "segment": "16_25",
      "metric": "live_news_18_consumption",
      "time_focus": 18
    },
    "recommendations": [
      {
        "template_id": "live_news_push_16_25",
        "description": "Push reminder for Live News at 18:00 for 16–25s.",
        "predicted_uplift": 0.12
      }
    ]
 * }
*/

const { bucket, experiment_assignment } = await response.json();

// Route user to appropriate experience
if (bucket === 'high_value') {
  showPremiumFeatures();
  trackExperiment(experiment_assignment.type, experiment_assignment.variant);
} else {
  showStandardFeatures();
}
```

### ML Recommender Pipeline

1. **Generate Data**: `make generate-experiment` creates synthetic experiment data
2. **Upload Data**: `make upload-experiment-data BUCKET=your-bucket`
3. **Run Pipeline**: SageMaker pipeline runs preprocessing, training, and evaluation
4. **Deploy Model**: Approved models are registered and the endpoint is updated
5. **Get Recommendations**: POST to `/recommend` endpoint with a goal

Example:

```typescript
// On user login/page load
const response = await fetch('/recommend', {
  method: 'POST',
  body: JSON.stringify({ goal: 'increase live news at 18:00 for 16-25s' })
});

/**
 * Example response:
 * {
    "goal": "increase live news at 18:00 for 16-25s",
    "parsed": {
      "segment": "16_25",
      "metric": "live_news_18_consumption",
      "time_focus": 18
    },
    "recommendations": [
      {
        "template_id": "live_news_push_16_25",
        "description": "Push reminder for Live News at 18:00 for 16–25s.",
        "predicted_uplift": 0.12
      }
    ]
 * }
*/

const { recommendations } = await response.json();

// Run the experiment
runExperiment(recommendations[0].template_id);
```

## Local Training

Train models locally for development:

```bash
# Train recommender model
make train-recommender

# Train bucketing model
make train-bucketing
```

## Configuration Options

### Feature Sources (User Bucketing)

The bucketing Lambda supports multiple feature sources, configured via environment variables:

| Source | Env Var Value | Description |
|--------|---------------|-------------|
| Mock | `FEATURE_SOURCE=mock` | Synthetic data for development (default) |
| DynamoDB | `FEATURE_SOURCE=dynamodb` | Real-time features from DynamoDB |
| Feature Store | `FEATURE_SOURCE=feature_store` | SageMaker Feature Store for ML features |

Additional configuration:
- `DYNAMODB_TABLE`: DynamoDB table name (default: `user-features`)
- `FEATURE_GROUP_NAME`: SageMaker Feature Group name (default: `user-bucketing-features`)

### Goal Parser (ML Recommender)

The recommender Lambda can parse goals using regex (fast) or Amazon Bedrock (flexible):

| Parser | Env Var | Description |
|--------|---------|-------------|
| Regex | `USE_BEDROCK_PARSER=false` | Fast, deterministic pattern matching (default) |
| Bedrock | `USE_BEDROCK_PARSER=true` | AI-powered natural language understanding |

When using Bedrock:
- `BEDROCK_MODEL_ID`: Model to use
- Requires appropriate IAM permissions for `bedrock:InvokeModel`

## Adding New ML Pipelines

To add a new ML pipeline:

1. Create scripts in `sagemaker-scripts/your-pipeline/` with:
   - `preprocess.py` - Data preprocessing
   - `train.py` - Model training
   - `evaluate.py` - Model evaluation and approval
   - `inference.py` - Inference handling

2. Add data generation in `data-generator/` if needed

3. Create a new stack in `cdk/lib/stacks/pipelines/your-pipeline-stack.ts` using the shared constructs:
   - `SageMakerPipeline` - Training workflow
   - `Endpoint` - Model deployment

4. Import and instantiate it in `cdk/bin/cdk.ts`

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
    vpc: network.vpc,
    securityGroup: network.sagemakerStudioSg,
    rawDataBucket: storage.rawDataBucket,
    processedDataBucket: storage.processedDataBucket,
    codeBucket: storage.codeBucket,
    dataKey: storage.kmsKey,
    pipelineRole: iam.pipelineRole,
  }
);
yourPipeline.addDependency(lakeFormation);
yourPipeline.addDependency(codeDeployment);
```
