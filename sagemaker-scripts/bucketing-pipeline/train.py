#!/usr/bin/env python3
import argparse
import os

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

from platform_shared import setup_logging, save_model_artifacts, MetricsTracker

logger = setup_logging(__name__)


def main():
    """
    Trains a scikit-learn classifier (RandomForest or LogisticRegression) on the training data and validates on the validation data.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--model_dir', type=str, default=os.environ.get('SM_MODEL_DIR', '/opt/ml/model'))
    parser.add_argument('--train', type=str, default=os.environ.get('SM_CHANNEL_TRAINING', '/opt/ml/input/data/training'))
    parser.add_argument('--validation', type=str, default=os.environ.get('SM_CHANNEL_VALIDATION', '/opt/ml/input/data/validation'))
    parser.add_argument('--n_estimators', type=int, default=100)
    parser.add_argument('--max_depth', type=int, default=10)
    parser.add_argument('--random_state', type=int, default=42)
    parser.add_argument('--model_type', type=str, default='random_forest', choices=['random_forest', 'logistic_regression'])
    args, _ = parser.parse_known_args()

    logger.info(f"Model type: {args.model_type}")
    logger.info(f"Hyperparameters: n_estimators={args.n_estimators}, max_depth={args.max_depth}")

    train_df = pd.read_csv(os.path.join(args.train, 'train.csv'))
    val_df = pd.read_csv(os.path.join(args.validation, 'validation.csv'))

    X_train = train_df.drop('target', axis=1)
    y_train = train_df['target']
    X_val = val_df.drop('target', axis=1)
    y_val = val_df['target']

    logger.info(f"Training data shape: {X_train.shape}")
    logger.info(f"Validation data shape: {X_val.shape}")
    logger.info(f"Target distribution in training: {y_train.value_counts().to_dict()}")

    if args.model_type == 'random_forest':
        model = RandomForestClassifier(
            n_estimators=args.n_estimators,
            max_depth=args.max_depth,
            random_state=args.random_state,
            n_jobs=-1
        )
    else:
        model = LogisticRegression(random_state=args.random_state, max_iter=1000)

    logger.info("Training model...")
    model.fit(X_train, y_train)

    y_pred = model.predict(X_val)
    y_pred_proba = model.predict_proba(X_val)[:, 1]

    metrics_tracker = MetricsTracker(logger)
    metrics = metrics_tracker.compute_classification_metrics(y_val, y_pred, y_pred_proba)

    if hasattr(model, 'feature_importances_'):
        feature_importance = dict(zip(X_train.columns, model.feature_importances_))
        top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]
        logger.info(f"Top 5 important features: {top_features}")

    metadata = {
        'model_type': args.model_type,
        'hyperparameters': {
            'n_estimators': args.n_estimators,
            'max_depth': args.max_depth,
            'random_state': args.random_state
        },
        'feature_names': list(X_train.columns),
        'training_samples': len(X_train),
        'validation_samples': len(X_val)
    }

    save_model_artifacts(args.model_dir, model, metrics, metadata)
    logger.info(f"Model saved to {args.model_dir}")
    logger.info("TRAINING COMPLETE")


if __name__ == '__main__':
    main()
