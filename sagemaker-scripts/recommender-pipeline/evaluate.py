#!/usr/bin/env python3
import argparse
import os

import pandas as pd
import xgboost as xgb

from platform_shared import setup_logging, ModelEvaluator, RECOMMENDER_THRESHOLDS

logger = setup_logging(__name__)

THRESHOLDS = RECOMMENDER_THRESHOLDS


def main():
    """
    This script is used to evaluate the recommender model during training.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-path', type=str, default='/opt/ml/processing/model')
    parser.add_argument('--test-path', type=str, default='/opt/ml/processing/test')
    parser.add_argument('--evaluation-path', type=str, default='/opt/ml/processing/evaluation')
    args = parser.parse_args()

    logger.info("Starting model evaluation...")

    evaluator = ModelEvaluator(logger, model_type='regression')
    model = evaluator.load_model(args.model_path, extension='.bst')

    test_df = pd.read_csv(os.path.join(args.test_path, 'test.csv'))
    X_test = test_df.drop('target', axis=1)
    y_test = test_df['target']

    logger.info(f"Test data shape: {X_test.shape}")

    dtest = xgb.DMatrix(X_test)
    
    # Predict uplift percentages - continuous regression values
    # Higher values indicate experiments expected to have greater positive impact
    y_pred = model.predict(dtest)

    # Compute regression metrics: RMSE, MAE, R²
    # - RMSE: Root Mean Squared Error (penalizes large errors more)
    # - MAE: Mean Absolute Error (average prediction error)
    # - R²: Coefficient of determination (proportion of variance explained, 1.0 = perfect)
    metrics = evaluator.compute_metrics(y_test, y_pred)

    mean_actual_uplift = y_test.mean()
    mean_predicted_uplift = y_pred.mean()
    prediction_bias = mean_predicted_uplift - mean_actual_uplift

    evaluation_metrics = {
        **{f'test_{k}': v for k, v in metrics.items()},
        'business_metrics': {
            'mean_actual_uplift': float(mean_actual_uplift),
            'mean_predicted_uplift': float(mean_predicted_uplift),
            'prediction_bias': float(prediction_bias),
            'total_test_samples': int(len(y_test))
        }
    }

    logger.info(f"Prediction Bias: {prediction_bias:.4f}")

    approval = evaluator.check_approval(THRESHOLDS)
    evaluator.save_results(args.evaluation_path, evaluation_metrics, approval)

    logger.info("EVALUATION COMPLETE")


if __name__ == '__main__':
    main()
