# SageMaker ML Pipelines

This directory contains the machine learning pipelines that run on AWS SageMaker, navigate to the individual pipelines for more details.

## Shared Infrastructure

All pipelines follow the SageMaker Processing/Training/Evaluation pattern and share common utilities from `shared/platform_shared/`.

## SageMaker Integration

The scripts follow SageMaker conventions:

- Default paths use `/opt/ml/` directories
- Environment variables (`SM_MODEL_DIR`, `SM_CHANNEL_TRAINING`) are respected
- Model artifacts are saved in SageMaker-compatible format
- Inference handlers implement `model_fn`, `input_fn`, `predict_fn`, `output_fn`

## Approval Gates

Both pipelines produce an `approval_status` in their evaluation output:

- `"approved"` if all thresholds pass
- `"rejected"` with failure reasons otherwise

This integrates with SageMaker Model Registry conditional registration—only approved models proceed to deployment.
