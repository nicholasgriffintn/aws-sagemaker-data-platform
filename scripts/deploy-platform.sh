#!/bin/bash

# Complete deployment script for AWS SageMaker Data Platform
# This script handles the full deployment process including sample data setup

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENV=${1:-dev}
SETUP_DATA=${2:-true}
SKIP_BUILD=${3:-false}

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                   AWS SageMaker Unified Studio Data Platform                  ║"
echo "║                              Deployment Script                                ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}🚀 Starting deployment for environment: ${ENV}${NC}"
echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   • Environment: ${ENV}"
echo "   • Setup Sample Data: ${SETUP_DATA}"
echo "   • Skip Build: ${SKIP_BUILD}"
echo ""

echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ CDK CLI is not installed. Install with: npm install -g aws-cdk${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${RED}❌ Node.js version 22+ required. Current version: $(node -v)${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed${NC}"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

CONFIG_FILE="config/environments/${ENV}.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Configuration file not found: ${CONFIG_FILE}${NC}"
    exit 1
fi

ACCOUNT_ID=$(jq -r '.awsAccount' "$CONFIG_FILE")

if [ "$SKIP_BUILD" != "true" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pnpm install --frozen-lockfile

    echo -e "${YELLOW}🔨 Building project...${NC}"
    pnpm run build
fi

echo -e "${YELLOW}🏗️  Bootstrapping CDK (if needed)...${NC}"
CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
CURRENT_REGION=$(aws configure get region)
cdk bootstrap "aws://${CURRENT_ACCOUNT}/${CURRENT_REGION}" || true

echo -e "${YELLOW}🚀 Deploying infrastructure...${NC}"
echo "This may take 10-15 minutes for the first deployment..."

if cdk deploy -c env="${ENV}" --all --require-approval never; then
    echo -e "${GREEN}✅ Infrastructure deployment completed successfully${NC}"
else
    echo -e "${RED}❌ Infrastructure deployment failed${NC}"
    exit 1
fi

if [ "$SETUP_DATA" = "true" ]; then
    echo -e "${YELLOW}📊 Setting up sample data...${NC}"
    
    chmod +x scripts/setup-sample-data.sh
    
    if ./scripts/setup-sample-data.sh "${ENV}"; then
        echo -e "${GREEN}✅ Sample data setup completed${NC}"
    else
        echo -e "${RED}❌ Sample data setup failed${NC}"
        echo -e "${YELLOW}You can run it manually later: ./scripts/setup-sample-data.sh ${ENV}${NC}"
    fi

    echo -e "${YELLOW}🔍 Initializing data catalog...${NC}"
    
    CRAWLER_NAME="${ENV}-raw-data-crawler"
    if aws glue start-crawler --name "$CRAWLER_NAME" 2>/dev/null; then
        echo -e "${GREEN}✅ Started Glue crawler: ${CRAWLER_NAME}${NC}"
        echo -e "${YELLOW}💡 Crawler is running in the background. It may take a few minutes to complete.${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not start crawler automatically. You can start it manually:${NC}"
        echo "   aws glue start-crawler --name ${CRAWLER_NAME}"
    fi
fi

echo -e "${YELLOW}📋 Getting deployment information...${NC}"

STACK_NAME="DataPlatform-${ENV}"
DOMAIN_ID=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --query "Stacks[0].Outputs[?OutputKey=='SageMakerDomainId'].OutputValue" \
    --output text 2>/dev/null || echo "Not found")

if [ "$DOMAIN_ID" != "Not found" ]; then
    CONSOLE_URL="https://console.aws.amazon.com/sagemaker/home?region=${CURRENT_REGION}#/studio/${DOMAIN_ID}"
fi

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                            🎉 DEPLOYMENT SUCCESSFUL! 🎉                       ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Platform Details:${NC}"
echo "   • Environment: ${ENV}"
echo "   • Stack Name: ${STACK_NAME}"
echo "   • SageMaker Domain ID: ${DOMAIN_ID}"
if [ -n "$CONSOLE_URL" ]; then
    echo "   • Console URL: ${CONSOLE_URL}"
fi

echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo ""
echo -e "${GREEN}1. Access Unified Studio:${NC}"
if [ -n "$CONSOLE_URL" ]; then
    echo "   Open: ${CONSOLE_URL}"
else
    echo "   • Go to AWS Console → SageMaker → Domains"
    echo "   • Select domain: ${DOMAIN_ID}"
    echo "   • Click 'Launch' → 'Studio'"
fi

echo ""
echo -e "${GREEN}2. Wait for Data Catalog (if applicable):${NC}"
echo "   • Check crawler status: aws glue get-crawler --name ${ENV}-raw-data-crawler"
echo "   • Once complete, tables will be available in Athena and Unified Studio"

echo ""
echo -e "${GREEN}3. Test Sample Queries:${NC}"
echo "   • In Athena or Unified Studio, try:"
echo "     SELECT * FROM \"${ENV}-data-catalog\".\"sales\" LIMIT 10;"

echo ""
echo -e "${GREEN}4. Run Sample ETL Job:${NC}"
echo "   aws glue start-job-run --job-name ${ENV}-sample-etl-job"

echo ""
echo -e "${GREEN}5. Explore AI Capabilities:${NC}"
echo "   • Create a new project in Unified Studio"
echo "   • Try the integrated Bedrock models and knowledge base"
echo "   • Build your first ML model with the sample data"

echo ""
echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo "   • Check the knowledge base documents for detailed guides"
echo "   • Monitor costs in AWS Cost Explorer"
echo "   • Join the sample data with your own datasets"
echo "   • Explore the pre-configured Athena workgroups and named queries"

echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   • Platform Guide: README.md"
echo "   • Troubleshooting: sample-data/knowledge-base/troubleshooting-faq.md"
echo "   • Data Science Guide: sample-data/knowledge-base/data-science-guide.md"

echo ""
echo -e "${GREEN}Happy data exploring! 🦍🦍${NC}"
