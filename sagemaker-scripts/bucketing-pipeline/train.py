#!/usr/bin/env python3
"""
Training script for user bucketing pipeline.

Trains a classification model to predict high-value users
for experiment assignment.
"""

import argparse
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import joblib
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Train user bucketing model for experiment assignment."""
    parser = argparse.ArgumentParser()
    
    parser.add_argument('--model-dir', type=str, default=os.environ.get('SM_MODEL_DIR', '/opt/ml/model'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAINING', '/opt/ml/input/data/training'))
    parser.add_argument('--validation', type=str, default=os.environ.get('SM_CHANNEL_VALIDATION', '/opt/ml/input/data/validation'))
    parser.add_argument('--n_estimators', type=int, default=100)
    parser.add_argument('--max_depth', type=int, default=10)
    parser.add_argument('--random_state', type=int, default=42)
    parser.add_argument('--model_type', type=str, default='random_forest', choices=['random_forest', 'logistic_regression'])
    
    args = parser.parse_args()
    
    logger.info("Starting model training...")
    logger.info(f"Model type: {args.model_type}")
    logger.info(f"Hyperparameters: n_estimators={args.n_estimators}, max_depth={args.max_depth}")
    
    train_df = pd.read_csv(os.path.join(args.train, 'train.csv'))
    val_df = pd.read_csv(os.path.join(args.validation, 'validation.csv'))
    
    X_train_processed = train_df.drop('target', axis=1)
    y_train = train_df['target']
    X_val_processed = val_df.drop('target', axis=1)
    y_val = val_df['target']
    
    raw_train_path = os.path.join(args.train, 'raw_train.csv')
    raw_val_path = os.path.join(args.validation, 'raw_validation.csv')
    
    use_pipeline = os.path.exists(raw_train_path) and os.path.exists(raw_val_path)
    
    if use_pipeline:
        raw_train_df = pd.read_csv(raw_train_path)
        raw_val_df = pd.read_csv(raw_val_path)
        X_train_raw = raw_train_df.drop('target', axis=1)
        X_val_raw = raw_val_df.drop('target', axis=1)
        logger.info("Raw training data available for pipeline training")
    else:
        logger.warning("Raw training data not found, will train on processed data")
        X_train_raw = X_train_processed
        X_val_raw = X_val_processed
    
    logger.info(f"Training data shape: {X_train_processed.shape}")
    logger.info(f"Validation data shape: {X_val_processed.shape}")
    logger.info(f"Target distribution in training: {y_train.value_counts().to_dict()}")
    
    # Create model
    if args.model_type == 'random_forest':
        model = RandomForestClassifier(
            n_estimators=args.n_estimators,
            max_depth=args.max_depth,
            random_state=args.random_state,
            n_jobs=-1
        )
    else:
        model = LogisticRegression(
            random_state=args.random_state,
            max_iter=1000
        )
    
    feature_transformer_path = os.path.join(args.train, 'feature_transformer.pkl')
    if os.path.exists(feature_transformer_path) and use_pipeline:
        feature_transformer = joblib.load(feature_transformer_path)
        logger.info("Loaded feature transformer for unified pipeline")
        
        pipeline = Pipeline([
            ('preprocessing', feature_transformer),
            ('classifier', model)
        ])
        
        logger.info("Training unified pipeline on raw data...")
        pipeline.fit(X_train_raw, y_train)
        
        y_pred = pipeline.predict(X_val_raw)
        y_pred_proba = pipeline.predict_proba(X_val_raw)[:, 1]
        
    else:
        logger.warning("Feature transformer not found, training model on processed data")
        model.fit(X_train_processed, y_train)
        pipeline = model
        
        y_pred = model.predict(X_val_processed)
        y_pred_proba = model.predict_proba(X_val_processed)[:, 1]
    
    # Evaluate
    logger.info("Evaluating model on validation set...")
    
    metrics = {
        'accuracy': float(accuracy_score(y_val, y_pred)),
        'precision': float(precision_score(y_val, y_pred)),
        'recall': float(recall_score(y_val, y_pred)),
        'f1_score': float(f1_score(y_val, y_pred)),
        'auc': float(roc_auc_score(y_val, y_pred_proba))
    }
    
    logger.info(f"Validation metrics: {metrics}")
    
    # Log feature importance
    if isinstance(pipeline, Pipeline):
        classifier = pipeline.named_steps['classifier']
        if hasattr(classifier, 'feature_importances_'):
            feature_names = pipeline.named_steps['preprocessing'].feature_columns
            feature_importance = dict(zip(feature_names, classifier.feature_importances_))
            top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]
            logger.info(f"Top 5 important features: {top_features}")
    elif hasattr(model, 'feature_importances_'):
        feature_importance = dict(zip(X_train_processed.columns, model.feature_importances_))
        top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]
        logger.info(f"Top 5 important features: {top_features}")
    
    # Save model
    os.makedirs(args.model_dir, exist_ok=True)
    
    if isinstance(pipeline, Pipeline):
        joblib.dump(pipeline, os.path.join(args.model_dir, 'model.pkl'))
        logger.info("Saved unified preprocessing + model pipeline")
    else:
        joblib.dump(model, os.path.join(args.model_dir, 'model.pkl'))
        logger.info("Saved model only (no preprocessing pipeline)")
    
    with open(os.path.join(args.model_dir, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)
    
    metadata = {
        'model_type': args.model_type,
        'hyperparameters': {
            'n_estimators': args.n_estimators,
            'max_depth': args.max_depth,
            'random_state': args.random_state
        },
        'feature_names': list(X_train_processed.columns),
        'training_samples': len(X_train_processed),
        'validation_samples': len(X_val_processed)
    }
    
    with open(os.path.join(args.model_dir, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"Model saved to {args.model_dir}")
    logger.info("TRAINING COMPLETE")


if __name__ == '__main__':
    main()

