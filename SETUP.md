# Full E2E Deployment Guide

Prerequisites
Make sure you have these installed:

```bash
node --version    # >= 22.10.0
python3 --version # >= 3.10
aws --version     # AWS CLI v2
pnpm --version # >= 10.14.0
```

If you don't have any of these, please install them.

## Step 1: Configure AWS Credentials

```bash
# Configure AWS CLI with your credentials
aws login

# Verify you're authenticated
aws sts get-caller-identity
```

## Step 2: Update Environment Config

Edit config/environments/dev.json with your AWS account ID:

```json
{
  "componentName": "aws-ml-platform",
  "awsAccount": "YOUR_AWS_ACCOUNT_ID",
  "awsRegion": "eu-west-1",
  "private": false,
  "endpointConfig": {
    "deployEndpoint": false,
    "useServerlessEndpoint": true
  }
}
```

Replace YOUR_AWS_ACCOUNT_ID with the account ID from aws sts get-caller-identity.

Note: `deployEndpoint` is `false` by default. Enable it after training your first model (see Step 11).

## Step 3: Install All Dependencies

```bash
make install
```

This installs:

- Node.js dependencies (CDK, TypeScript)
- Python dependencies for data generation, Glue jobs, SageMaker scripts, and Lambdas
- Frontend dependencies

## Step 4: Bootstrap CDK (First-Time Only)

If you've never used CDK in this AWS account/region:

```bash
pnpm run cdk bootstrap aws://YOUR_ACCOUNT_ID/eu-west-1
```

## Step 5: Build the Project

```bash
make build
```

## Step 6: Preview What Will Be Deployed

```bash
make diff
```

## Step 7: Deploy Stacks

### Demo environment

If you are just deploying the demo environment, run:

```bash
# Deploy slim demo (storage + IAM + pipelines + frontend)
pnpm cdk deploy --context env=demo --all --require-approval never
```

### Full environment

```bash
make deploy
```

Or with explicit environment:

`pnpm run cdk deploy -c env=dev --all --require-approval never`

## Step 8: Generate and Upload Raw Data

After deployment completes, generate synthetic raw data and upload to the raw S3 bucket:

**First, find your raw data bucket name:**

```bash
# For dev environment
aws cloudformation describe-stacks \
  --stack-name aws-ml-platform-Storage-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`raw_data_bucket_name`].OutputValue' \
  --output text

# For demo environment
aws cloudformation describe-stacks \
  --stack-name aws-ml-platform-Storage-demo \
  --query 'Stacks[0].Outputs[?OutputKey==`raw_data_bucket_name`].OutputValue' \
  --output text
```

**Then generate and upload:**

```bash
# Generate synthetic data locally
make generate-data

# Upload raw data to S3 raw bucket (replace with your actual bucket name)
make upload-raw-data RAW_BUCKET=aws-ml-platform-dev-raw-data-bucket
```

Or upload specific datasets:

```bash
# Upload individual data (replace with your actual bucket name)
make upload-experiment-data RAW_BUCKET=aws-ml-platform-dev-raw-data-bucket
make upload-bucketing-data RAW_BUCKET=aws-ml-platform-dev-raw-data-bucket
```

## Step 9: Run the Data Pipeline

The platform uses a complete data pipeline workflow:

1. **Raw Data** → S3 Raw Bucket
2. **Glue ETL** → Processes raw data into training-ready format
3. **SageMaker Pipeline** → Trains and evaluates ML models

### Option A: Run Glue ETL Locally

You can process data locally without provisioning Glue jobs.

This workflow uses the [AWS Glue 5.0 Docker image](https://aws.amazon.com/blogs/big-data/develop-and-test-aws-glue-5-0-jobs-locally-using-a-docker-container/) and the `glue/local/docker-compose.yml` configuration.

To run the Glue ETL jobs locally, run the command for your required pipeline. These commands mount the repo into the container and execute `spark-submit` inside the AWS Glue 5.0 runtime:

```bash
# For recommender pipeline (experiment data)
make run-local-experiment-etl

# For bucketing pipeline (if you need it)
make run-local-bucketing-etl
```

Processed outputs are written to `glue/local/processed/...`.

Then you need to find your processed data bucket name:

```bash
aws cloudformation describe-stacks \
  --stack-name aws-ml-platform-Storage-demo \
  --query 'Stacks[0].Outputs[?OutputKey==`processed_data_bucket_name`].OutputValue' \
  --output text
```

Then you can upload the processed data to S3:

```bash
# For recommender pipeline (experiment data)
make upload-processed-experiment-data PROCESSED_BUCKET=aws-ml-platform-demo-processed-data-bucket

# Or upload all processed data
make upload-processed-data PROCESSED_BUCKET=aws-ml-platform-demo-processed-data-bucket
```

The Makefile also exposes `upload-processed-bucketing-data` and `upload-processed-experiment-data` if you need to upload independently.

After the processed data is uploaded, you can run the SageMaker pipelines:

```bash
# (replace with your actual pipeline name)
aws sagemaker start-pipeline-execution --pipeline-name aws-ml-platform-dev-bucketing-pipeline
aws sagemaker start-pipeline-execution --pipeline-name aws-ml-platform-dev-recommender-pipeline
```

### Option B: Run the Full Pipeline on AWS (requires full setup)

Run the complete end-to-end workflow using Step Functions:

```bash
# Run full pipeline: ETL + ML training for both models
make run-pipeline
```

Or run individual pipelines:

```bash
# Bucketing pipeline only
make run-bucketing-pipeline

# Recommender pipeline only
make run-recommender-pipeline
```

### Option C: Run Individual Steps (requires full setup)

Run Glue ETL jobs separately:

```bash
# Process bucketing raw data
make run-bucketing-etl

# Process experiment raw data
make run-experiment-etl
```

Then run SageMaker pipelines:

```bash
# (replace with your actual pipeline name)
aws sagemaker start-pipeline-execution --pipeline-name aws-ml-platform-dev-bucketing-pipeline
aws sagemaker start-pipeline-execution --pipeline-name aws-ml-platform-dev-recommender-pipeline
```

## Step 10: Monitor Pipeline Execution

```bash
# List Step Function executions (replace with your actual state machine name)
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-west-1:$(aws sts get-caller-identity --query Account --output text):stateMachine:aws-ml-platform-dev-full-data-pipeline

# Check Glue job runs (replace with your actual job name)
aws glue get-job-runs --job-name aws-ml-platform-dev-bucketing-etl
aws glue get-job-runs --job-name aws-ml-platform-dev-experiment-etl

# List SageMaker pipeline executions (replace with your actual pipeline name)
aws sagemaker list-pipeline-executions --pipeline-name aws-ml-platform-dev-bucketing-pipeline
aws sagemaker list-pipeline-executions --pipeline-name aws-ml-platform-dev-recommender-pipeline
```

## Step 11: Enable Endpoint Deployment

By default, SageMaker endpoints are not deployed to avoid costs during initial setup. Once your pipeline has successfully trained a model, enable endpoint deployment:

1. Edit your environment config file:

**For dev environment** - Edit `config/environments/dev.json`:
```json
{
  "endpointConfig": {
    "deployEndpoint": true,
    "useServerlessEndpoint": true
  }
}
```

**For demo environment** - Edit `config/environments/demo.json`:
```json
{
  "endpointConfig": {
    "deployEndpoint": true,
    "useServerlessEndpoint": true
  }
}
```

2. Redeploy to create the endpoints:

```bash
make deploy

# For demo environment
pnpm cdk deploy --context env=demo --all --require-approval never
```

Setting `useServerlessEndpoint: true` uses SageMaker Serverless Inference which scales to zero when idle. For production workloads with consistent traffic, set `useServerlessEndpoint: false` to use real-time endpoints.

## Step 12: Test the APIs

Once the endpoints are deployed, get the API URLs from CloudFormation outputs:

```bash
# Get API Gateway URLs
aws cloudformation describe-stacks \
  --stack-name aws-ml-platform-ExperimentPipeline-dev \
  --query 'Stacks[0].Outputs' --output table

aws cloudformation describe-stacks \
  --stack-name aws-ml-platform-RecommenderPipeline-dev \
  --query 'Stacks[0].Outputs' --output table
```

Test the recommender API:

```bash
curl -X POST https://YOUR_API_URL/recommend \
  -H "Content-Type: application/json" \
  -d '{"goal": "increase live news at 18:00 for 16-25s"}'
```

Test the bucketing API:

```bash
curl -X POST https://YOUR_API_URL/bucket \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123"}'
```

## Step 13: Access SageMaker Studio

Go to AWS Console → SageMaker → Domains and open your studio to explore:

- Training jobs
- Model registry
- Feature Store
- Pipeline executions

## Step 14: Configure the Frontend

Inject the API endpoint URLs and keys into the frontend configuration:

```bash
# (replace with your actual environment)
cd frontend && node scripts/inject-config.js dev
```

This script fetches the API Gateway URLs and API keys from CloudFormation outputs and writes them to `src/config/endpoints.ts`.

After configuring the frontend, build and deploy it:

```bash
cd frontend && pnpm run build
```

And then from the root directory:

```bash
# For dev environment
make deploy

# For demo environment
pnpm cdk deploy --context env=demo --all --require-approval never
```

## Step 15: View the Frontend

Get the CloudFront URL:

(replace with your actual environment)
```bash
aws cloudformation describe-stacks \
  --stack-name aws-ml-platform-Frontend-dev \
  --query 'Stacks[0].Outputs' --output table
```

## Step 16: Clean Up

```bash
make destroy
```
