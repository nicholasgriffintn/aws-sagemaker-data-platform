#!/usr/bin/env python3
"""
Evaluation script for user bucketing pipeline.

Evaluates trained model on test set and generates approval recommendation.
"""

import argparse
import os
import pandas as pd
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, 
    f1_score, roc_auc_score, confusion_matrix, classification_report
)
import joblib
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Model approval thresholds
MIN_ACCURACY = 0.75
MIN_PRECISION = 0.70
MIN_RECALL = 0.65
MIN_AUC = 0.80


def main():
    """Evaluate trained user bucketing model on test set."""
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-path', type=str, default='/opt/ml/processing/model')
    parser.add_argument('--test-path', type=str, default='/opt/ml/processing/test')
    parser.add_argument('--evaluation-path', type=str, default='/opt/ml/processing/evaluation')
    
    args = parser.parse_args()
    
    logger.info("Starting model evaluation...")
    
    # Load model
    model_file = os.path.join(args.model_path, 'model.pkl')
    if not os.path.exists(model_file):
        model_files = [f for f in os.listdir(args.model_path) if f.endswith('.pkl') and 'model' in f]
        if model_files:
            model_file = os.path.join(args.model_path, model_files[0])
        else:
            raise FileNotFoundError(f"No model file found in {args.model_path}")
    
    model = joblib.load(model_file)
    logger.info(f"Loaded model from {model_file}")
    
    # Load test data
    test_df = pd.read_csv(os.path.join(args.test_path, 'test.csv'))
    X_test = test_df.drop('target', axis=1)
    y_test = test_df['target']
    
    logger.info(f"Test data shape: {X_test.shape}")
    logger.info(f"Test target distribution: {y_test.value_counts().to_dict()}")
    
    # Make predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # Calculate metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_pred_proba)
    
    cm = confusion_matrix(y_test, y_pred)
    class_report = classification_report(y_test, y_pred, output_dict=True)
    
    # Business metrics
    total_users = len(y_test)
    predicted_high_value = np.sum(y_pred)
    actual_high_value = np.sum(y_test)
    correctly_identified_high_value = np.sum((y_test == 1) & (y_pred == 1))
    
    bucketing_efficiency = correctly_identified_high_value / max(predicted_high_value, 1)
    coverage = correctly_identified_high_value / max(actual_high_value, 1)
    
    evaluation_metrics = {
        'test_accuracy': float(accuracy),
        'test_precision': float(precision),
        'test_recall': float(recall),
        'test_f1_score': float(f1),
        'test_auc': float(auc),
        'confusion_matrix': cm.tolist(),
        'classification_report': class_report,
        'business_metrics': {
            'total_test_users': int(total_users),
            'actual_high_value_users': int(actual_high_value),
            'predicted_high_value_users': int(predicted_high_value),
            'correctly_identified_high_value': int(correctly_identified_high_value),
            'bucketing_efficiency': float(bucketing_efficiency),
            'coverage': float(coverage),
            'high_value_precision': float(precision),
            'high_value_recall': float(recall)
        }
    }
    
    logger.info(f"Test Accuracy: {accuracy:.4f}")
    logger.info(f"Test Precision: {precision:.4f}")
    logger.info(f"Test Recall: {recall:.4f}")
    logger.info(f"Test F1-Score: {f1:.4f}")
    logger.info(f"Test AUC: {auc:.4f}")
    logger.info(f"Bucketing Efficiency: {bucketing_efficiency:.4f}")
    logger.info(f"Coverage: {coverage:.4f}")
    
    os.makedirs(args.evaluation_path, exist_ok=True)
    
    with open(os.path.join(args.evaluation_path, 'evaluation_metrics.json'), 'w') as f:
        json.dump(evaluation_metrics, f, indent=2)
    
    # Model approval decision
    approval_criteria = {
        'accuracy_pass': accuracy >= MIN_ACCURACY,
        'precision_pass': precision >= MIN_PRECISION,
        'recall_pass': recall >= MIN_RECALL,
        'auc_pass': auc >= MIN_AUC
    }
    
    all_criteria_met = all(approval_criteria.values())
    
    recommendation = {
        'approve_model': all_criteria_met,
        'approval_criteria': approval_criteria,
        'thresholds': {
            'min_accuracy': MIN_ACCURACY,
            'min_precision': MIN_PRECISION,
            'min_recall': MIN_RECALL,
            'min_auc': MIN_AUC
        },
        'recommendation_reason': 'All criteria met' if all_criteria_met else 'Some criteria not met'
    }
    
    with open(os.path.join(args.evaluation_path, 'model_approval.json'), 'w') as f:
        json.dump(recommendation, f, indent=2)
    
    logger.info(f"Model approval recommendation: {'APPROVE' if all_criteria_met else 'REJECT'}")
    logger.info("EVALUATION COMPLETE")


if __name__ == '__main__':
    main()

