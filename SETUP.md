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
  "private": false
}
```

Replace YOUR_AWS_ACCOUNT_ID with the account ID from aws sts get-caller-identity.

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

## Step 7: Deploy All Stacks

```bash
make deploy
```

Or with explicit environment:

`pnpm run cdk deploy -c env=dev --all --require-approval never`

## Step 8: Generate and Upload Training Data

After deployment completes, get your bucket name from the outputs (or use the default):

```bash
# Generate synthetic data
make generate-data

# Upload to S3 (replace with your actual bucket)
make upload-data BUCKET=aws-ml-platform-dev-processed-data-bucket
```

Or upload specific datasets:

```bash
make upload-experiment-data BUCKET=aws-ml-platform-dev-processed-data-bucket
make upload-bucketing-data BUCKET=aws-ml-platform-dev-processed-data-bucket
```

## Step 9: Run the SageMaker Pipelines

Go to the AWS Console → SageMaker → Pipelines. You'll see two pipelines:

- `aws-ml-platform-dev-bucketing-pipeline`
- `aws-ml-platform-dev-recommender-pipeline`

Click each one and hit "Start execution" to train the models.
Alternatively, use the AWS CLI:

```bash
aws sagemaker start-pipeline-execution --pipeline-name aws-ml-platform-dev-bucketing-pipeline
aws sagemaker start-pipeline-execution --pipeline-name aws-ml-platform-dev-recommender-pipeline
```

## Step 10: Test the APIs

Once the pipelines complete and endpoints are deployed, get the API URLs from CloudFormation outputs:

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

## Step 11: Access SageMaker Studio

Go to AWS Console → SageMaker → Domains and open your studio to explore:

- Training jobs
- Model registry
- Feature Store
- Pipeline executions

## Step 12: View the Frontend

Get the CloudFront URL:

```bash
aws cloudformation describe-stacks \
  --stack-name aws-ml-platform-Frontend-dev \
  --query 'Stacks[0].Outputs' --output table
```
