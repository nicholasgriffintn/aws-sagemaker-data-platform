# Common operations for development and deployment

.PHONY: install build deploy destroy generate-data upload-data etl train package-model upload-model update-endpoint recommend clean help

# ---- Configuration ----
BUCKET ?= aws-ml-platform-dev-processed-data-bucket
API ?= your-api-gateway-url.execute-api.eu-west-1.amazonaws.com
ENVIRONMENT ?= dev

# ---- Help ----
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
	@echo "Data & ETL:"
	@echo "  make generate-data    Generate synthetic experiment data"
	@echo "  make upload-data      Upload generated data to S3"
	@echo "  make etl              Run the Glue ETL job"
	@echo ""
	@echo "Model Training:"
	@echo "  make train            Preprocess and train model locally"
	@echo "  make package-model    Package model artifacts for SageMaker"
	@echo "  make upload-model     Upload model to S3"
	@echo "  make update-endpoint  Update SageMaker endpoint with new model"
	@echo ""
	@echo "Recommender API:"
	@echo "  make recommend        Test the recommender API"
	@echo ""
	@echo "Configuration:"
	@echo "  BUCKET=bucket-name    Set S3 bucket (default: $(BUCKET))"
	@echo "  API=api-url           Set API Gateway URL"
	@echo "  ENVIRONMENT=env       Set environment (default: $(ENVIRONMENT))"

# ---- Basic Setup ----
install:
	pnpm install
	pip install -r glue/requirements.txt
	pip install -r sagemaker-scripts/experiment-pipeline/requirements.txt
	pip install -r sagemaker-scripts/recommender-pipeline/requirements.txt
	pip install -r lambdas/data-ingestion/requirements.txt
	pip install -r lambdas/recommender/requirements.txt

build:
	pnpm run build

clean:
	rm -rf cdk.out dist node_modules
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true

# ---- CDK Deployment ----
deploy:
	pnpm run build
	pnpm run cdk deploy -c env=$(ENVIRONMENT) --all --require-approval never

destroy:
	pnpm run cdk destroy -c env=$(ENVIRONMENT) --all --force

# ---- Synthetic Data ----
generate-data:
	python data-generator/generate_data.py

upload-data:
	@if [ -z "$(BUCKET)" ]; then echo "Error: BUCKET not set"; exit 1; fi
	aws s3 sync output/raw/experiments s3://$(BUCKET)/raw/experiments

# ---- Glue ETL ----
etl:
	aws glue start-job-run --job-name aws-ml-platform-$(ENVIRONMENT)-ml-experiment-feature-etl

# ---- Training ----
train:
	@echo "Preprocessing data..."
	python sagemaker-scripts/recommender-pipeline/preprocess.py \
		--input_path s3://$(BUCKET)/processed/experiments_ml/features \
		--output_path sagemaker-scripts/recommender-pipeline/processed
	@echo "Training model..."
	python sagemaker-scripts/recommender-pipeline/train.py \
		--train_path sagemaker-scripts/recommender-pipeline/processed \
		--model_dir sagemaker-scripts/recommender-pipeline/

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

# ---- Recommender API ----
recommend:
	@if [ -z "$(API)" ]; then echo "Error: API not set"; exit 1; fi
	curl -X POST https://$(API)/recommend \
		-H "Content-Type: application/json" \
		-d '{"goal": "increase live news at 18:00 for 16-25s"}'
