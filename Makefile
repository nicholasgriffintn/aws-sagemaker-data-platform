.PHONY: install build deploy destroy generate-data upload-data upload-raw-data train package-model upload-model update-endpoint recommend clean help build-frontend inject-config run-pipeline run-bucketing-pipeline run-recommender-pipeline

RAW_BUCKET ?= aws-ml-platform-dev-raw-data-bucket
PROCESSED_BUCKET ?= aws-ml-platform-dev-processed-data-bucket
API ?= your-api-gateway-url.execute-api.eu-west-1.amazonaws.com
ENVIRONMENT ?= dev
COMPONENT ?= aws-ml-platform

help:
	@echo "AWS ML Platform - Available Commands"
	@echo "====================================="
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install all dependencies"
	@echo "  make build            Build the CDK TypeScript project"
	@echo "  make clean            Remove build artifacts and dependencies"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy           Deploy all stacks to AWS"
	@echo "  make destroy          Destroy all stacks from AWS"
	@echo ""
	@echo "Data Pipeline (AWS):"
	@echo "  make upload-raw-data         Upload generated raw data to S3 raw bucket"
	@echo "  make run-pipeline            Run full data pipeline (ETL + ML training)"
	@echo "  make run-bucketing-pipeline  Run bucketing pipeline only"
	@echo "  make run-recommender-pipeline Run recommender pipeline only"
	@echo "  make run-bucketing-etl       Run bucketing Glue ETL job"
	@echo "  make run-experiment-etl      Run experiment Glue ETL job"
	@echo ""
	@echo "Data Generation (Local):"
	@echo "  make generate-data           Generate all synthetic data locally"
	@echo "  make generate-experiment     Generate experiment data (recommender)"
	@echo "  make generate-bucketing      Generate user bucketing data"
	@echo ""
	@echo "Local Model Training:"
	@echo "  make train-recommender   Train recommender model locally"
	@echo "  make train-bucketing     Train bucketing model locally"
	@echo "  make package-model       Package model artifacts for SageMaker"
	@echo "  make upload-model        Upload model to S3"
	@echo ""
	@echo "API Testing:"
	@echo "  make recommend        Test the recommender API"
	@echo ""
	@echo "Frontend:"
	@echo "  make build-frontend   Build the documentation frontend"
	@echo "  make dev-frontend     Run frontend in development mode"
	@echo "  make inject-config    Inject API URLs into frontend config"
	@echo ""
	@echo "Configuration:"
	@echo "  RAW_BUCKET=bucket       Set raw data S3 bucket (default: $(RAW_BUCKET))"
	@echo "  PROCESSED_BUCKET=bucket Set processed data S3 bucket (default: $(PROCESSED_BUCKET))"
	@echo "  API=api-url             Set API Gateway URL"
	@echo "  ENVIRONMENT=env         Set environment (default: $(ENVIRONMENT))"
	@echo "  COMPONENT=name          Set component name (default: $(COMPONENT))"

install:
	pnpm install
	cd frontend && pnpm install
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -e shared
	.venv/bin/pip install -r data-generator/requirements.txt
	.venv/bin/pip install -r glue/requirements.txt
	.venv/bin/pip install -r sagemaker-scripts/bucketing-pipeline/requirements.txt
	.venv/bin/pip install -r sagemaker-scripts/recommender-pipeline/requirements.txt
	.venv/bin/pip install -r lambdas/bucketing/requirements.txt
	.venv/bin/pip install -r lambdas/recommender/requirements.txt
	@echo ""
	@echo "Python virtual environment created at .venv"
	@echo "Activate it with: source .venv/bin/activate"

bundle-sagemaker-scripts:
	@echo "Bundling shared library into SageMaker scripts..."
	cp -r shared/platform_shared sagemaker-scripts/bucketing-pipeline/
	cp -r shared/platform_shared sagemaker-scripts/recommender-pipeline/
	@echo "Creating sourcedir.tar.gz for containers..."
	cd sagemaker-scripts/bucketing-pipeline && tar -czf sourcedir.tar.gz *.py requirements.txt platform_shared
	cd sagemaker-scripts/recommender-pipeline && tar -czf sourcedir.tar.gz *.py requirements.txt platform_shared

build: bundle-sagemaker-scripts
	pnpm run build

diff:
	pnpm run diff

clean:
	rm -rf cdk.out dist node_modules .venv
	rm -rf data-generator/output
	rm -rf sagemaker-scripts/bucketing-pipeline/platform_shared
	rm -rf sagemaker-scripts/recommender-pipeline/platform_shared
	rm -f sagemaker-scripts/bucketing-pipeline/sourcedir.tar.gz
	rm -f sagemaker-scripts/recommender-pipeline/sourcedir.tar.gz
	rm -rf frontend/node_modules frontend/.next frontend/out
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

deploy:
	pnpm run build
	pnpm run cdk deploy -c env=$(ENVIRONMENT) --all --require-approval never

destroy:
	pnpm run cdk destroy -c env=$(ENVIRONMENT) --all --force

generate-data:
	cd data-generator && ../.venv/bin/python main.py all

generate-experiment:
	cd data-generator && ../.venv/bin/python main.py experiment

generate-bucketing:
	cd data-generator && ../.venv/bin/python main.py bucketing

upload-raw-data:
	@echo "Uploading raw data to S3 raw bucket..."
	@if [ -z "$(RAW_BUCKET)" ]; then echo "Error: RAW_BUCKET not set"; exit 1; fi
	cd data-generator && ../.venv/bin/python main.py all --upload --bucket $(RAW_BUCKET)

upload-experiment-data:
	@if [ -z "$(RAW_BUCKET)" ]; then echo "Error: RAW_BUCKET not set"; exit 1; fi
	cd data-generator && ../.venv/bin/python main.py experiment --upload --bucket $(RAW_BUCKET)

upload-bucketing-data:
	@if [ -z "$(RAW_BUCKET)" ]; then echo "Error: RAW_BUCKET not set"; exit 1; fi
	cd data-generator && ../.venv/bin/python main.py bucketing --upload --bucket $(RAW_BUCKET)

upload-data: upload-raw-data

run-bucketing-etl:
	@echo "Starting Bucketing ETL job..."
	aws glue start-job-run --job-name $(COMPONENT)-$(ENVIRONMENT)-bucketing-etl

run-experiment-etl:
	@echo "Starting Experiment ETL job..."
	aws glue start-job-run --job-name $(COMPONENT)-$(ENVIRONMENT)-experiment-etl

run-pipeline:
	@echo "Starting full data pipeline (Step Functions)..."
	aws stepfunctions start-execution \
		--state-machine-arn arn:aws:states:eu-west-1:$$(aws sts get-caller-identity --query Account --output text):stateMachine:$(COMPONENT)-$(ENVIRONMENT)-full-data-pipeline

run-bucketing-pipeline:
	@echo "Starting bucketing data pipeline (Step Functions)..."
	aws stepfunctions start-execution \
		--state-machine-arn arn:aws:states:eu-west-1:$$(aws sts get-caller-identity --query Account --output text):stateMachine:$(COMPONENT)-$(ENVIRONMENT)-bucketing-data-pipeline

run-recommender-pipeline:
	@echo "Starting recommender data pipeline (Step Functions)..."
	aws stepfunctions start-execution \
		--state-machine-arn arn:aws:states:eu-west-1:$$(aws sts get-caller-identity --query Account --output text):stateMachine:$(COMPONENT)-$(ENVIRONMENT)-recommender-data-pipeline

train-recommender:
	@echo "Preprocessing recommender data..."
	.venv/bin/python sagemaker-scripts/recommender-pipeline/preprocess.py \
		--input_path data-generator/output/raw/experiments \
		--output_path sagemaker-scripts/recommender-pipeline/processed
	@echo "Training recommender model..."
	.venv/bin/python sagemaker-scripts/recommender-pipeline/train.py \
		--train_path sagemaker-scripts/recommender-pipeline/processed \
		--model_dir sagemaker-scripts/recommender-pipeline/

train-bucketing:
	@echo "Preprocessing bucketing data..."
	.venv/bin/python sagemaker-scripts/bucketing-pipeline/preprocess.py \
		--input-data data-generator/output/raw/bucketing \
		--train-data sagemaker-scripts/bucketing-pipeline/processed/train \
		--validation-data sagemaker-scripts/bucketing-pipeline/processed/validation \
		--test-data sagemaker-scripts/bucketing-pipeline/processed/test
	@echo "Training bucketing model..."
	.venv/bin/python sagemaker-scripts/bucketing-pipeline/train.py \
		--train sagemaker-scripts/bucketing-pipeline/processed/train \
		--validation sagemaker-scripts/bucketing-pipeline/processed/validation \
		--model-dir sagemaker-scripts/bucketing-pipeline/

package-model:
	cd sagemaker-scripts/recommender-pipeline && \
	tar -czvf model.tar.gz model.bst feature_list.pkl inference.py

upload-model:
	@if [ -z "$(BUCKET)" ]; then echo "Error: BUCKET not set"; exit 1; fi
	aws s3 cp sagemaker-scripts/recommender-pipeline/model.tar.gz \
		s3://$(BUCKET)/model-artifacts/model.tar.gz

update-endpoint:
	aws sagemaker update-endpoint \
		--endpoint-name aws-ml-platform-$(ENVIRONMENT)-recommender-endpoint \
		--endpoint-config-name aws-ml-platform-$(ENVIRONMENT)-recommender-endpoint-config

recommend:
	@if [ -z "$(API)" ]; then echo "Error: API not set"; exit 1; fi
	curl -X POST https://$(API)/recommend \
		-H "Content-Type: application/json" \
		-d '{"goal": "increase live news at 18:00 for 16-25s"}'

install-frontend:
	cd frontend && pnpm install

inject-config:
	cd frontend && node scripts/inject-config.js $(ENVIRONMENT)

build-frontend: install-frontend inject-config
	cd frontend && pnpm run build

dev-frontend: install-frontend
	cd frontend && pnpm run dev

deploy-all: build build-frontend
	pnpm run cdk deploy -c env=$(ENVIRONMENT) --all --require-approval never
