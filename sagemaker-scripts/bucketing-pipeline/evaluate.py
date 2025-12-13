#!/usr/bin/env python3
import argparse
import os

import pandas as pd
import numpy as np
from sklearn.metrics import confusion_matrix, classification_report

from platform_shared import setup_logging, ModelEvaluator, BUCKETING_THRESHOLDS

logger = setup_logging(__name__)

THRESHOLDS = BUCKETING_THRESHOLDS


def main():
    """
    Evaluates against thresholds defined in the shared library.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-path', type=str, default='/opt/ml/processing/model')
    parser.add_argument('--test-path', type=str, default='/opt/ml/processing/test')
    parser.add_argument('--evaluation-path', type=str, default='/opt/ml/processing/evaluation')
    args = parser.parse_args()

    logger.info("Starting model evaluation...")

    evaluator = ModelEvaluator(logger, model_type='classification')
    model = evaluator.load_model(args.model_path, extension='.pkl')

    test_df = pd.read_csv(os.path.join(args.test_path, 'test.csv'))
    X_test = test_df.drop('target', axis=1)
    y_test = test_df['target']

    logger.info(f"Test data shape: {X_test.shape}")
    logger.info(f"Test target distribution: {y_test.value_counts().to_dict()}")

    # Generate predictions on held-out test set
    # This provides an unbiased estimate of model performance on new data
    y_pred = model.predict(X_test)
    
    # Probability estimates needed for metrics like AUC-ROC and threshold tuning
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    # Compute classification metrics: accuracy, precision, recall, F1, AUC-ROC
    # These measure different aspects of model performance:
    # - Precision: Of predicted high-value users, how many are actually high-value?
    # - Recall: Of actual high-value users, how many did we identify?
    # - F1: Harmonic mean of precision and recall (balanced metric)
    # - AUC-ROC: Ability to distinguish between classes (higher = better)
    metrics = evaluator.compute_metrics(y_test, y_pred, y_pred_proba)

    cm = confusion_matrix(y_test, y_pred)
    class_report = classification_report(y_test, y_pred, output_dict=True)

    total_users = len(y_test)
    predicted_high_value = np.sum(y_pred)
    actual_high_value = np.sum(y_test)
    correctly_identified_high_value = np.sum((y_test == 1) & (y_pred == 1))
    bucketing_efficiency = correctly_identified_high_value / max(predicted_high_value, 1)
    coverage = correctly_identified_high_value / max(actual_high_value, 1)

    evaluation_metrics = {
        **{f'test_{k}': v for k, v in metrics.items()},
        'confusion_matrix': cm.tolist(),
        'classification_report': class_report,
        'business_metrics': {
            'total_test_users': int(total_users),
            'actual_high_value_users': int(actual_high_value),
            'predicted_high_value_users': int(predicted_high_value),
            'correctly_identified_high_value': int(correctly_identified_high_value),
            'bucketing_efficiency': float(bucketing_efficiency),
            'coverage': float(coverage),
            'high_value_precision': float(metrics['precision']),
            'high_value_recall': float(metrics['recall'])
        }
    }

    logger.info(f"Bucketing Efficiency: {bucketing_efficiency:.4f}")
    logger.info(f"Coverage: {coverage:.4f}")

    approval = evaluator.check_approval(THRESHOLDS)
    evaluator.save_results(args.evaluation_path, evaluation_metrics, approval)

    logger.info("EVALUATION COMPLETE")


if __name__ == '__main__':
    main()
