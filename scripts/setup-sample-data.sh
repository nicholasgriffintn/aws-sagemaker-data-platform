#!/bin/bash

# Setup Sample Data for AWS SageMaker Data Platform
# This script uploads sample data to S3 buckets after CDK deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENV=${1:-dev}

echo -e "${GREEN}Setting up sample data for environment: ${ENV}${NC}"

STACK_NAME="DataPlatform-${ENV}"

echo -e "${YELLOW}Getting S3 bucket names from CloudFormation stack...${NC}"

get_export_value() {
    local export_name=$1
    aws cloudformation list-exports \
        --query "Exports[?Name=='${export_name}'].Value" \
        --output text 2>/dev/null || echo ""
}

RAW_BUCKET=$(get_export_value "${ENV}-RawBucketName")
CURATED_BUCKET=$(get_export_value "${ENV}-CuratedBucketName") 
PROJECT_BUCKET=$(get_export_value "${ENV}-ProjectBucketName")

if [[ -z "$RAW_BUCKET" ]]; then
    echo -e "${YELLOW}Trying to get bucket names from nested DataLake stack...${NC}"
    
    DATALAKE_STACK=$(aws cloudformation list-stack-resources \
        --stack-name "${STACK_NAME}" \
        --query "StackResourceSummaries[?LogicalResourceId=='DataLake'].PhysicalResourceId" \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$DATALAKE_STACK" ]]; then
        echo "Found DataLake stack: ${DATALAKE_STACK}"
        
        RAW_BUCKET=$(aws cloudformation describe-stacks \
            --stack-name "${DATALAKE_STACK}" \
            --query "Stacks[0].Outputs[?contains(OutputKey,'RawBucket') && !contains(OutputKey,'Arn')].OutputValue" \
            --output text 2>/dev/null || echo "")
        
        CURATED_BUCKET=$(aws cloudformation describe-stacks \
            --stack-name "${DATALAKE_STACK}" \
            --query "Stacks[0].Outputs[?contains(OutputKey,'CuratedBucket') && !contains(OutputKey,'Arn')].OutputValue" \
            --output text 2>/dev/null || echo "")
            
        PROJECT_BUCKET=$(aws cloudformation describe-stacks \
            --stack-name "${DATALAKE_STACK}" \
            --query "Stacks[0].Outputs[?contains(OutputKey,'ProjectArtifactsBucket') && !contains(OutputKey,'Arn')].OutputValue" \
            --output text 2>/dev/null || echo "")
    fi
fi

if [[ -z "$RAW_BUCKET" ]]; then
    echo -e "${YELLOW}Discovering buckets by prefix...${NC}"
    RAW_BUCKET=$(aws s3 ls | grep "dataplatform-${ENV}-datalake-rawbucket" | awk '{print $3}' | head -1)
    CURATED_BUCKET=$(aws s3 ls | grep "dataplatform-${ENV}-datalake-curatedbucket" | awk '{print $3}' | head -1)
    PROJECT_BUCKET=$(aws s3 ls | grep "dataplatform-${ENV}-datalake-projectartifactsbucket" | awk '{print $3}' | head -1)
fi

if [[ -z "$RAW_BUCKET" || -z "$CURATED_BUCKET" || -z "$PROJECT_BUCKET" ]]; then
    echo -e "${RED}Error: Could not find S3 bucket names. Please ensure the stack is deployed.${NC}"
    echo "Raw bucket: ${RAW_BUCKET}"
    echo "Curated bucket: ${CURATED_BUCKET}"
    echo "Project bucket: ${PROJECT_BUCKET}"
    exit 1
fi

echo -e "${GREEN}Found buckets:${NC}"
echo "  Raw Data: ${RAW_BUCKET}"
echo "  Curated Data: ${CURATED_BUCKET}"
echo "  Project Artifacts: ${PROJECT_BUCKET}"

echo -e "${YELLOW}Uploading sample data...${NC}"

echo "Uploading sales data..."
aws s3 cp sample-data/raw/sales/sales_data.csv "s3://${RAW_BUCKET}/sales/" --quiet

echo "Uploading customer data..."
aws s3 cp sample-data/raw/customers/customer_data.json "s3://${RAW_BUCKET}/customers/" --quiet

echo "Uploading product data..."
aws s3 cp sample-data/raw/products/products.parquet "s3://${RAW_BUCKET}/products/" --quiet

echo "Uploading sample curated data..."
aws s3 cp sample-data/curated/sales_summary.csv "s3://${CURATED_BUCKET}/sales-summary/" --quiet

echo "Uploading Glue ETL script..."
aws s3 cp scripts/glue-etl/sample-etl.py "s3://${PROJECT_BUCKET}/glue-scripts/" --quiet

echo "Uploading knowledge base documents..."
aws s3 sync sample-data/knowledge-base/ "s3://${PROJECT_BUCKET}/knowledge-base/" --quiet

echo -e "${GREEN}✅ Sample data setup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run the Glue crawler to discover the schema:"
echo "   aws glue start-crawler --name ${ENV}-raw-data-crawler"
echo ""
echo "2. After crawler completes, query data in Athena:"
echo "   SELECT * FROM \"${ENV}-data-catalog\".\"sales\" LIMIT 10;"
echo ""
echo "3. Test the Glue ETL job:"
echo "   aws glue start-job-run --job-name ${ENV}-sample-etl-job"
echo ""
echo "4. Access SageMaker Unified Studio through the AWS Console"
