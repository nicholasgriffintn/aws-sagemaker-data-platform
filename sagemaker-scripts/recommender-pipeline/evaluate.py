#!/usr/bin/env python3
"""
Evaluation script for recommender pipeline.

Evaluates trained XGBoost model on test set and generates approval recommendation.
"""

import argparse
import os
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Model approval thresholds for regression
MAX_RMSE = 5.0
MAX_MAE = 3.0
MIN_R2 = 0.6


def main():
    """Evaluate trained recommender model on test set."""
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-path', type=str, default='/opt/ml/processing/model')
    parser.add_argument('--test-path', type=str, default='/opt/ml/processing/test')
    parser.add_argument('--evaluation-path', type=str, default='/opt/ml/processing/evaluation')
    
    args = parser.parse_args()
    
    logger.info("Starting model evaluation...")
    
    # Load model
    model_file = os.path.join(args.model_path, 'model.bst')
    if not os.path.exists(model_file):
        model_files = [f for f in os.listdir(args.model_path) if f.endswith('.bst')]
        if model_files:
            model_file = os.path.join(args.model_path, model_files[0])
        else:
            raise FileNotFoundError(f"No model file found in {args.model_path}")
    
    model = xgb.Booster()
    model.load_model(model_file)
    logger.info(f"Loaded model from {model_file}")
    
    # Load test data
    X_test = pd.read_parquet(os.path.join(args.test_path, 'X_val.parquet'))
    y_test = pd.read_parquet(os.path.join(args.test_path, 'y_val.parquet'))['uplift_pct']
    
    logger.info(f"Test data shape: {X_test.shape}")
    
    # Make predictions
    dtest = xgb.DMatrix(X_test)
    y_pred = model.predict(dtest)
    
    # Calculate metrics
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    # Business metrics
    mean_actual_uplift = y_test.mean()
    mean_predicted_uplift = y_pred.mean()
    prediction_bias = mean_predicted_uplift - mean_actual_uplift
    
    evaluation_metrics = {
        'test_rmse': float(rmse),
        'test_mae': float(mae),
        'test_r2': float(r2),
        'business_metrics': {
            'mean_actual_uplift': float(mean_actual_uplift),
            'mean_predicted_uplift': float(mean_predicted_uplift),
            'prediction_bias': float(prediction_bias),
            'total_test_samples': int(len(y_test))
        }
    }
    
    logger.info(f"Test RMSE: {rmse:.4f}")
    logger.info(f"Test MAE: {mae:.4f}")
    logger.info(f"Test R2: {r2:.4f}")
    logger.info(f"Prediction Bias: {prediction_bias:.4f}")
    
    os.makedirs(args.evaluation_path, exist_ok=True)
    
    with open(os.path.join(args.evaluation_path, 'evaluation_metrics.json'), 'w') as f:
        json.dump(evaluation_metrics, f, indent=2)
    
    # Model approval decision
    approval_criteria = {
        'rmse_pass': rmse <= MAX_RMSE,
        'mae_pass': mae <= MAX_MAE,
        'r2_pass': r2 >= MIN_R2
    }
    
    all_criteria_met = all(approval_criteria.values())
    
    recommendation = {
        'approve_model': all_criteria_met,
        'approval_criteria': approval_criteria,
        'thresholds': {
            'max_rmse': MAX_RMSE,
            'max_mae': MAX_MAE,
            'min_r2': MIN_R2
        },
        'recommendation_reason': 'All criteria met' if all_criteria_met else 'Some criteria not met'
    }
    
    with open(os.path.join(args.evaluation_path, 'model_approval.json'), 'w') as f:
        json.dump(recommendation, f, indent=2)
    
    logger.info(f"Model approval recommendation: {'APPROVE' if all_criteria_met else 'REJECT'}")
    logger.info("EVALUATION COMPLETE")


if __name__ == '__main__':
    main()

