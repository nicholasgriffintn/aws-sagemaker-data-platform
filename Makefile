# ---- Basic Setup ----
install:
	cd cdk && npm install
	pip install -r glue/requirements.txt
	pip install -r model/requirements.txt
	pip install -r recommender/requirements.txt

# ---- CDK Deployment ----
deploy:
	cd cdk && npm run build && npx cdk deploy --all

destroy:
	cd cdk && npx cdk destroy --all

# ---- Synthetic Data ----
generate-data:
	python data-generator/generate_data.py

upload-data:
	aws s3 sync output/raw/experiments s3://$(BUCKET)/raw/experiments

# ---- Glue ETL ----
etl:
	aws glue start-job-run --job-name ml-experiment-feature-etl

# ---- Training ----
train:
	# Preprocess + train locally
	python model/preprocess.py \
	    --input_path s3://$(BUCKET)/processed/experiments_ml/features \
	    --output_path model/processed

	python model/train.py \
	    --train_path model/processed \
	    --model_dir model/

package-model:
	tar -czvf model.tar.gz -C model model.bst feature_list.pkl inference.py

upload-model:
	aws s3 cp model.tar.gz s3://$(BUCKET)/model-artifacts/model.tar.gz

update-endpoint:
	aws sagemaker update-endpoint \
	    --endpoint-name experiment-recommender-endpoint \
	    --endpoint-config-name experiment-recommender-endpoint-config

# ---- Recommender API ----
recommend:
	curl -X POST https://$(API)/recommend \
	  -H "Content-Type: application/json" \
	  -d '{"goal": "increase live news at 18:00 for 16-25s"}'