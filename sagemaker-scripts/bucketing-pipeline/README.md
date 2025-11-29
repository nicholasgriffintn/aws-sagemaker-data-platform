## Bucketing Pipeline

### Purpose

The bucketing pipeline solves the problem of **intelligent user segmentation for A/B testing**. Rather than randomly assigning users to experiments, it identifies high-value users so they can receive targeted treatment variants or be excluded from risky experiments.

A user is considered "high value" if they fall in both the top 30% of engagement scores AND top 40% of total spending. This dual-threshold approach ensures we identify users who are both engaged and monetising.

### Data Flow

```
Raw User Data (CSV)
       │
       ▼
┌─────────────────┐
│   Preprocess    │  → Feature engineering, encoding, scaling
└────────┬────────┘
         │
         ▼
   train.csv, validation.csv, test.csv
   feature_transformer.pkl
         │
         ▼
┌─────────────────┐
│     Train       │  → RandomForest or LogisticRegression
└────────┬────────┘
         │
         ▼
   model.pkl (sklearn Pipeline)
         │
         ▼
┌─────────────────┐
│    Evaluate     │  → Metrics + approval decision
└────────┬────────┘
         │
         ▼
   evaluation.json
```

### Input Features

The pipeline expects user-level data with these raw features:

| Feature                      | Type  | Description                        |
| ---------------------------- | ----- | ---------------------------------- |
| `age`                        | int   | User's age (0-120)                 |
| `session_count`              | int   | Total sessions on platform         |
| `avg_session_duration`       | float | Mean session length in seconds     |
| `page_views`                 | int   | Total pages viewed                 |
| `purchase_history`           | int   | Number of purchases made           |
| `total_spent`                | float | Lifetime spend in currency         |
| `engagement_score`           | float | Normalised engagement metric (0-1) |
| `historical_conversion_rate` | float | Past conversion rate (0-1)         |
| `gender`                     | str   | User gender (male/female/other)    |
| `location`                   | str   | Geographic location code           |

### Feature Engineering

The preprocessing step creates derived features that improve model performance:

- **spend_per_purchase**: Average order value (`total_spent / purchase_history`)
- **session_efficiency**: Pages viewed per session (`page_views / session_count`)
- **age_group**: Bucketed age (young/adult/middle_aged/senior)
- **spending_tier**: Bucketed spend level (none/low/medium/high)

Categorical features are label-encoded, and all features are standardised via `StandardScaler`.

### Model Architecture

The training step produces a **sklearn Pipeline** that bundles:

1. `FeatureEngineeringTransformer` - The preprocessing logic
2. `RandomForestClassifier` or `LogisticRegression` - The classifier

This unified pipeline design means inference only needs raw features—no separate preprocessing step required. The same transformation logic used during training is automatically applied during prediction.

### Hyperparameters

| Parameter      | Default       | Description                                           |
| -------------- | ------------- | ----------------------------------------------------- |
| `model_type`   | random_forest | Classifier type (random_forest / logistic_regression) |
| `n_estimators` | 100           | Number of trees (RandomForest only)                   |
| `max_depth`    | 10            | Maximum tree depth                                    |
| `random_state` | 42            | Reproducibility seed                                  |

### Evaluation Metrics

The pipeline tracks both ML metrics and business metrics:

**ML Metrics:**

- Accuracy, Precision, Recall, F1-Score, AUC-ROC

**Business Metrics:**

- **Bucketing Efficiency**: Of users predicted high-value, what % actually are? (precision)
- **Coverage**: Of actual high-value users, what % did we identify? (recall)

**Approval Thresholds:**

```
Accuracy  >= 0.75
Precision >= 0.70
Recall    >= 0.65
AUC       >= 0.80
```

### Inference Output

When deployed, the model returns:

```json
{
  "user_index": 0,
  "predicted_bucket": "high_value",
  "confidence": 0.87,
  "high_value_probability": 0.87,
  "standard_probability": 0.13,
  "experiment_assignment": {
    "experiment_type": "premium_features",
    "variant": "A",
    "priority": "high"
  },
  "model_version": "unified_pipeline"
}
```

The `experiment_assignment` field suggests which experiment track suits the user based on their predicted value and confidence:

| Prediction | Probability | Assignment                                |
| ---------- | ----------- | ----------------------------------------- |
| High-value | > 0.8       | premium_features (high priority)          |
| High-value | ≤ 0.8       | engagement_boost (medium priority)        |
| Standard   | > 0.3       | conversion_optimization (medium priority) |
| Standard   | ≤ 0.3       | basic_features (low priority)             |

## Running Locally

For local testing, install dependencies:

```bash
# Bucketing pipeline
pip install -r sagemaker-scripts/bucketing-pipeline/requirements.txt

# Shared library
pip install -e shared/
```

Run preprocessing:

```bash
python sagemaker-scripts/bucketing-pipeline/preprocess.py \
  --input-data ./data/raw \
  --train-data ./data/train \
  --validation-data ./data/validation \
  --test-data ./data/test
```

Run training:

```bash
python sagemaker-scripts/bucketing-pipeline/train.py \
  --train ./data/train \
  --validation ./data/validation \
  --model-dir ./models
```
