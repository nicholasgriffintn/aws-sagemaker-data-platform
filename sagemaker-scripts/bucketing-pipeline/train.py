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
    Trains a scikit-learn classifier (RandomForest or LogisticRegression) on the training data 
    and validates on the validation data.
    
    This is a binary classification task: predicting whether a user is "high_value" (1) or "standard" (0).
    The model learns patterns from user features (age, engagement, spending, etc.) to identify
    high-value users for targeted marketing and personalization.
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
        # RandomForestClassifier: An ensemble method that builds multiple decision trees
        # Each tree is trained on a random bootstrap sample of the data (with replacement)
        # At each split, only a random subset of features is considered (default: sqrt(n_features))
        # Predictions are made by majority voting across all trees
        # 
        # Learn more: https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html
        # Algorithm overview: https://scikit-learn.org/stable/modules/ensemble.html#forest
        # 
        # Key parameters:
        # - n_estimators: Number of trees in the forest. More trees = better generalization but slower.
        #   Typical range: 100-500. Diminishing returns after ~200-300 trees.
        # - max_depth: Maximum depth of each tree. Controls overfitting:
        #   * Lower values (5-10): More regularization, faster training, less overfitting
        #   * Higher values (15+): Can capture complex patterns but risks overfitting
        #   * None: Trees grow until all leaves are pure (can overfit severely)
        # - n_jobs=-1: Use all CPU cores for parallel tree construction
        #
        # Alternative configurations to consider:
        # - max_features: Control feature randomness (default='sqrt'). Try 'log2' or 0.5 for more diversity
        # - min_samples_split: Minimum samples to split a node (default=2). Increase (e.g., 5-10) to reduce overfitting
        # - min_samples_leaf: Minimum samples in leaf nodes (default=1). Increase (e.g., 2-4) for smoother predictions
        # - class_weight: Handle imbalanced data ('balanced' or dict)
        # Full parameter reference: https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html#sklearn.ensemble.RandomForestClassifier
        model = RandomForestClassifier(
            n_estimators=args.n_estimators,
            max_depth=args.max_depth,
            random_state=args.random_state,
            n_jobs=-1
        )
    else:
        # LogisticRegression: A linear classifier that models the probability of class membership
        # Uses the logistic function (sigmoid) to map linear combinations of features to probabilities
        # Optimizes using gradient descent or similar methods to minimize log-loss
        #
        # Learn more: https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html
        # Linear models guide: https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression
        #
        # Key parameters:
        # - max_iter: Maximum iterations for solver convergence. Increase if convergence warnings appear
        # - random_state: Ensures reproducibility of random initialization
        #
        # Alternative configurations to consider:
        # - C: Inverse regularization strength (default=1.0). Higher = less regularization, more complex model
        #   * Lower C (0.01-0.1): More regularization, simpler model, better generalization
        #   * Higher C (10-100): Less regularization, can overfit on small datasets
        # - penalty: Regularization type ('l1' for Lasso, 'l2' for Ridge, 'elasticnet' for both)
        #   * L1 can perform feature selection by zeroing coefficients
        #   * L2 shrinks coefficients but keeps all features
        # - solver: Optimization algorithm ('lbfgs', 'liblinear', 'saga', etc.)
        #   * 'lbfgs': Good for small datasets, supports L2/None penalty
        #   * 'liblinear': Fast for small datasets, supports L1/L2
        #   * 'saga': Supports all penalties, good for large datasets
        # - class_weight: Handle imbalanced data ('balanced' or dict)
        # Full parameter reference: https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html#sklearn.linear_model.LogisticRegression
        model = LogisticRegression(random_state=args.random_state, max_iter=1000)

    logger.info("Training model...")
    # fit() trains the model on the training data
    # For RandomForest: Builds n_estimators trees, each on a bootstrap sample
    # For LogisticRegression: Optimizes coefficients to minimize log-loss
    model.fit(X_train, y_train)

    # predict() returns the predicted class (0 or 1 for binary classification)
    # For RandomForest: Majority vote across all trees
    # For LogisticRegression: Class with probability > 0.5
    y_pred = model.predict(X_val)
    
    # predict_proba() returns probability estimates for each class
    # [:, 1] extracts probabilities for the positive class (high_value_user)
    # Useful for threshold tuning and confidence scoring
    y_pred_proba = model.predict_proba(X_val)[:, 1]

    metrics_tracker = MetricsTracker(logger)
    metrics = metrics_tracker.compute_classification_metrics(y_val, y_pred, y_pred_proba)

    # Feature importance analysis (only available for tree-based models like RandomForest)
    # Importance is calculated as the total reduction in impurity (Gini/entropy) 
    # contributed by each feature across all trees, normalized to sum to 1
    # Higher values indicate features that contribute more to predictions
    # Note: LogisticRegression doesn't have feature_importances_ (use coefficients instead)
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
