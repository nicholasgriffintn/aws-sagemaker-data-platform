# Recommender Pipeline

## Purpose

The recommender pipeline answers questions like: "which experiments should we run first?" The model predicts expected uplift percentage for proposed experiments based on historical outcomes.

This enables data-driven prioritisation: experiments with higher predicted uplift get scheduled sooner, while low-uplift experiments can be deprioritised or redesigned.

## Data Flow

```
Experiment Results (Parquet)
       │
       ▼
┌─────────────────┐
│   Preprocess    │  → Numeric casting, train/val split
└────────┬────────┘
         │
         ▼
   X_train.parquet, X_val.parquet
   y_train.parquet, y_val.parquet
   feature_list.pkl
         │
         ▼
┌─────────────────┐
│     Train       │  → XGBoost regressor
└────────┬────────┘
         │
         ▼
   model.bst, feature_list.pkl
         │
         ▼
┌─────────────────┐
│    Evaluate     │  → Metrics + approval decision
└────────┬────────┘
         │
         ▼
   evaluation.json
```

## Input Features

The pipeline expects experiment-level data with these features:

| Feature               | Type | Description                                   |
| --------------------- | ---- | --------------------------------------------- |
| `num_variants`        | int  | Number of variants in the experiment          |
| `duration_days`       | int  | Planned experiment duration                   |
| `start_hour_of_day`   | int  | Launch hour (0-23)                            |
| `start_day_of_week`   | int  | Launch day (0-6, Monday=0)                    |
| `start_month`         | int  | Launch month (1-12)                           |
| `surface`             | str  | Where experiment runs (web/mobile/email/etc.) |
| `platform`            | str  | Technical platform (ios/android/web)          |
| `content_scope`       | str  | What's being changed                          |
| `experiment_type`     | str  | Category of experiment                        |
| `segment_encoded`     | int  | Target user segment (encoded)                 |
| `is_personalised`     | bool | Whether variants are personalised             |
| `is_algorithm_change` | bool | Whether it changes ranking/rec algorithms     |
| `is_copy_only`        | bool | Whether it's text-only changes                |
| `uses_notifications`  | bool | Whether push notifications are involved       |

## Target Variable

The model predicts `uplift_pct`—the percentage improvement in the primary metric when the winning variant is deployed. For example, an uplift of 2.5 means the experiment improved the metric by 2.5%.

## Why XGBoost?

XGBoost was chosen because:

1. **Handles mixed feature types** well (numeric + encoded categorical)
2. **Built-in regularisation** prevents overfitting on limited historical data
3. **Early stopping** automatically finds optimal training duration
4. **Feature importance** helps interpret what drives experiment success
5. **Fast inference** for real-time recommendations

## Hyperparameters

| Parameter               | Default | Description                                |
| ----------------------- | ------- | ------------------------------------------ |
| `max_depth`             | 8       | Maximum tree depth                         |
| `eta`                   | 0.05    | Learning rate                              |
| `subsample`             | 0.8     | Row sampling ratio                         |
| `colsample_bytree`      | 0.8     | Column sampling ratio                      |
| `num_boost_round`       | 400     | Maximum boosting rounds                    |
| `early_stopping_rounds` | 20      | Rounds without improvement before stopping |

The low learning rate (0.05) combined with early stopping ensures the model generalises well rather than memorising training data.

## Evaluation Metrics

**ML Metrics:**

- RMSE (Root Mean Squared Error)
- MAE (Mean Absolute Error)
- R² (Coefficient of Determination)

**Business Metrics:**

- **Mean Actual Uplift**: Average uplift in test set
- **Mean Predicted Uplift**: Average prediction
- **Prediction Bias**: Systematic over/under-prediction

**Approval Thresholds:**

```
RMSE <= 5.0
MAE  <= 3.0
R²   >= 0.6
```

## Inference Output

When deployed, the model returns:

```json
{
  "predictions": [2.34, -0.5, 4.12]
}
```

Each value is the predicted uplift percentage for the corresponding input experiment. Negative values indicate predicted negative impact.

## Running Locally

For local testing, install dependencies:

```bash
# Recommender pipeline
pip install -r sagemaker-scripts/recommender-pipeline/requirements.txt

# Shared library
pip install -e shared/
```

Run preprocessing:

```bash
python sagemaker-scripts/recommender-pipeline/preprocess.py \
  --input-data ./data/raw \
  --train-data ./data/train \
  --validation-data ./data/validation \
  --test-data ./data/test
```

Run training:

```bash
python sagemaker-scripts/recommender-pipeline/train.py \
  --train ./data/train \
  --validation ./data/validation \
  --model-dir ./models
```
