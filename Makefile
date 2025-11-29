# Common operations for development and deployment

.PHONY: install build deploy destroy generate-data upload-data train package-model upload-model update-endpoint recommend clean help

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
	@echo "Data Generation:"
	@echo "  make generate-data           Generate all synthetic data"
	@echo "  make generate-experiment     Generate experiment data (recommender)"
	@echo "  make generate-bucketing      Generate user bucketing data"
	@echo "  make upload-data             Upload all generated data to S3"
	@echo ""
	@echo "Model Training:"
	@echo "  make train-recommender   Train recommender model locally"
	@echo "  make train-bucketing     Train bucketing model locally"
	@echo "  make package-model       Package model artifacts for SageMaker"
	@echo "  make upload-model        Upload model to S3"
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
	pip install -r data-generator/requirements.txt
	pip install -r glue/requirements.txt
	pip install -r sagemaker-scripts/bucketing-pipeline/requirements.txt
	pip install -r sagemaker-scripts/recommender-pipeline/requirements.txt
	pip install -r lambdas/recommender/requirements.txt

build:
	pnpm run build

clean:
	rm -rf cdk.out dist node_modules
	rm -rf data-generator/output
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true

# ---- CDK Deployment ----
deploy:
	pnpm run build
	pnpm run cdk deploy -c env=$(ENVIRONMENT) --all --require-approval never

destroy:
	pnpm run cdk destroy -c env=$(ENVIRONMENT) --all --force

# ---- Data Generation ----
generate-data:
	cd data-generator && python main.py all

generate-experiment:
	cd data-generator && python main.py experiment

generate-bucketing:
	cd data-generator && python main.py bucketing

upload-data:
	@if [ -z "$(BUCKET)" ]; then echo "Error: BUCKET not set"; exit 1; fi
	cd data-generator && python main.py all --upload --bucket $(BUCKET)

upload-experiment-data:
	@if [ -z "$(BUCKET)" ]; then echo "Error: BUCKET not set"; exit 1; fi
	cd data-generator && python main.py experiment --upload --bucket $(BUCKET)

upload-bucketing-data:
	@if [ -z "$(BUCKET)" ]; then echo "Error: BUCKET not set"; exit 1; fi
	cd data-generator && python main.py bucketing --upload --bucket $(BUCKET)

# ---- Training ----
train-recommender:
	@echo "Preprocessing recommender data..."
	python sagemaker-scripts/recommender-pipeline/preprocess.py \
		--input_path data-generator/output/raw/experiments \
		--output_path sagemaker-scripts/recommender-pipeline/processed
	@echo "Training recommender model..."
	python sagemaker-scripts/recommender-pipeline/train.py \
		--train_path sagemaker-scripts/recommender-pipeline/processed \
		--model_dir sagemaker-scripts/recommender-pipeline/

train-bucketing:
	@echo "Preprocessing bucketing data..."
	python sagemaker-scripts/bucketing-pipeline/preprocess.py \
		--input-data data-generator/output/raw/bucketing \
		--train-data sagemaker-scripts/bucketing-pipeline/processed/train \
		--validation-data sagemaker-scripts/bucketing-pipeline/processed/validation \
		--test-data sagemaker-scripts/bucketing-pipeline/processed/test
	@echo "Training bucketing model..."
	python sagemaker-scripts/bucketing-pipeline/train.py \
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

# ---- Recommender API ----
recommend:
	@if [ -z "$(API)" ]; then echo "Error: API not set"; exit 1; fi
	curl -X POST https://$(API)/recommend \
		-H "Content-Type: application/json" \
		-d '{"goal": "increase live news at 18:00 for 16-25s"}'
