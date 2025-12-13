#!/usr/bin/env python3
import argparse
import os
import shutil

import pandas as pd
import xgboost as xgb
import joblib

from platform_shared import setup_logging, save_model_artifacts, MetricsTracker

logger = setup_logging(__name__)


def main():
    """
    Trains an XGBoost regression model to predict uplift percentages.
    
    XGBoost (eXtreme Gradient Boosting) is a gradient boosting framework that builds
    decision trees sequentially. Each new tree corrects errors from previous trees,
    using gradient descent to minimize a loss function (RMSE for regression).
    
    Key advantages:
    - Handles non-linear relationships and feature interactions automatically
    - Built-in regularization to prevent overfitting
    - Efficient handling of missing values
    - Fast training with parallel tree construction
    
    Documentation:
    - API Reference: https://xgboost.readthedocs.io/en/stable/python/python_api.html
    - Parameters Guide: https://xgboost.readthedocs.io/en/stable/parameter.html
    - Tutorial: https://xgboost.readthedocs.io/en/stable/tutorials/index.html
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_dir", type=str, default=os.environ.get("SM_MODEL_DIR", "/opt/ml/model"))
    parser.add_argument("--train", type=str, default=os.environ.get("SM_CHANNEL_TRAINING", "/opt/ml/input/data/training"))
    parser.add_argument("--validation", type=str, default=os.environ.get("SM_CHANNEL_VALIDATION", "/opt/ml/input/data/validation"))
    parser.add_argument("--max_depth", type=int, default=8)
    parser.add_argument("--eta", type=float, default=0.05)
    parser.add_argument("--subsample", type=float, default=0.8)
    parser.add_argument("--colsample_bytree", type=float, default=0.8)
    parser.add_argument("--num_boost_round", type=int, default=400)
    parser.add_argument("--early_stopping_rounds", type=int, default=20)
    parser.add_argument("--model_type", type=str, default="xgboost")
    parser.add_argument("--n_estimators", type=int, default=100)
    parser.add_argument("--random_state", type=int, default=42)
    args, _ = parser.parse_known_args()

    logger.info(f"Training data path: {args.train}")
    logger.info(f"Validation data path: {args.validation}")
    logger.info(f"Model output path: {args.model_dir}")

    train_df = pd.read_csv(os.path.join(args.train, "train.csv"))
    val_df = pd.read_csv(os.path.join(args.validation, "validation.csv"))

    X_train = train_df.drop("target", axis=1)
    y_train = train_df["target"]
    X_val = val_df.drop("target", axis=1)
    y_val = val_df["target"]

    logger.info(f"Training data shape: {X_train.shape}")
    logger.info(f"Validation data shape: {X_val.shape}")

    # DMatrix: XGBoost's optimized data structure for training
    # Stores data in a compressed format that enables faster training and lower memory usage
    # Learn more: https://xgboost.readthedocs.io/en/stable/python/python_api.html#xgboost.DMatrix
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)

    # XGBoost parameters explained:
    # Full parameter reference: https://xgboost.readthedocs.io/en/stable/parameter.html
    # Parameter tuning guide: https://xgboost.readthedocs.io/en/stable/tutorials/param_tuning.html
    #
    # - max_depth: Maximum depth of each tree (default=6)
    #   * Lower (3-5): More regularization, faster, less overfitting, simpler patterns
    #   * Higher (8-12): Can capture complex interactions but risks overfitting
    #   * Current: 8 - balanced complexity
    #
    # - eta (learning_rate): Step size shrinkage (default=0.3)
    #   * Lower (0.01-0.1): More conservative updates, requires more trees, better generalization
    #   * Higher (0.2-0.3): Faster convergence but may overshoot optimal solution
    #   * Current: 0.05 - conservative learning for better generalization
    #
    # - objective: "reg:squarederror" - minimizes mean squared error for regression
    #   * Alternative: "reg:absoluteerror" for MAE, "reg:pseudohubererror" for robust regression
    #   * All objectives: https://xgboost.readthedocs.io/en/stable/parameter.html#learning-task-parameters
    #
    # - subsample: Fraction of samples used per tree (default=1.0)
    #   * Lower (0.6-0.8): Introduces randomness, reduces overfitting (similar to RandomForest)
    #   * Current: 0.8 - good balance between variance reduction and training data usage
    #
    # - colsample_bytree: Fraction of features used per tree (default=1.0)
    #   * Lower (0.6-0.8): More tree diversity, reduces overfitting, similar to RandomForest's max_features
    #   * Current: 0.8 - introduces feature-level randomness
    #
    # - eval_metric: "rmse" - Root Mean Squared Error for regression
    #   * Used for early stopping and monitoring training progress
    #   * All metrics: https://xgboost.readthedocs.io/en/stable/parameter.html#learning-task-parameters
    #
    # Additional parameters to consider:
    # - min_child_weight: Minimum sum of instance weight in child (default=1)
    #   * Higher values (3-7): More conservative, prevents learning from small groups
    # - gamma: Minimum loss reduction to split (default=0)
    #   * Higher values (0.1-1): More conservative, fewer splits, simpler trees
    # - lambda: L2 regularization on weights (default=1)
    #   * Higher values: More regularization, smoother predictions
    # - alpha: L1 regularization on weights (default=0)
    #   * Can perform feature selection by zeroing feature weights
    params = {
        "max_depth": args.max_depth,
        "eta": args.eta,
        "objective": "reg:squarederror",
        "subsample": args.subsample,
        "colsample_bytree": args.colsample_bytree,
        "eval_metric": "rmse"
    }

    logger.info(f"Training with params: {params}")

    # xgb.train() builds trees sequentially:
    # 1. Starts with initial prediction (usually mean of target for regression)
    # 2. For each round:
    #    - Computes gradients (residuals) of current model
    #    - Builds a tree to predict these gradients
    #    - Adds tree to ensemble with learning_rate (eta) shrinkage
    # 3. Stops early if validation metric doesn't improve
    #
    # Learn more: https://xgboost.readthedocs.io/en/stable/python/python_api.html#xgboost.train
    # Training API: https://xgboost.readthedocs.io/en/stable/python/python_api.html#training
    #
    # - num_boost_round: Maximum number of boosting rounds (trees)
    #   * More rounds = more capacity but risk of overfitting
    #   * With early_stopping, actual rounds may be less
    #   * Current: 400 - high capacity, relies on early stopping
    #
    # - early_stopping_rounds: Stops if validation metric doesn't improve for N rounds
    #   * Prevents overfitting by stopping when model stops generalizing
    #   * Returns model from best iteration (bst.best_iteration)
    #   * Current: 20 - reasonable patience before stopping
    #
    # - evals: Monitors both training and validation sets
    #   * Training metric shows model capacity
    #   * Validation metric shows generalization (watch for large gap = overfitting)
    #
    # - verbose_eval: Print metrics every N rounds (50 = every 50 trees)
    bst = xgb.train(
        params,
        dtrain,
        evals=[(dtrain, "train"), (dval, "val")],
        num_boost_round=args.num_boost_round,
        early_stopping_rounds=args.early_stopping_rounds,
        verbose_eval=50
    )

    # Predict uplift percentages on validation set
    # XGBoost prediction: Sum of predictions from all trees in the ensemble
    # Each tree contributes a small correction, final prediction is the sum
    y_pred = bst.predict(dval)
    
    metrics_tracker = MetricsTracker(logger)
    # Computes regression metrics: RMSE, MAE, R², etc.
    # These measure how well the model predicts continuous uplift values
    regression_metrics = metrics_tracker.compute_regression_metrics(y_val, y_pred)

    metrics = {
        **regression_metrics,
        # best_iteration: The iteration number with best validation score
        # Useful for understanding how many trees were actually needed
        "best_iteration": bst.best_iteration,
        # best_score: The best validation RMSE achieved
        # Lower is better for RMSE
        "best_score": float(bst.best_score),
        "num_features": len(X_train.columns),
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
    }

    save_model_artifacts(args.model_dir, bst, metrics, model_filename='model.bst')

    feature_list_src = os.path.join(args.train, "feature_list.pkl")
    feature_list_dst = os.path.join(args.model_dir, "feature_list.pkl")
    if os.path.exists(feature_list_src):
        shutil.copy(feature_list_src, feature_list_dst)
        logger.info(f"Feature list copied to: {feature_list_dst}")
    else:
        feature_list = list(X_train.columns)
        joblib.dump(feature_list, feature_list_dst)
        logger.info(f"Feature list created and saved to: {feature_list_dst}")

    logger.info(f"Training metrics: {metrics}")
    logger.info("TRAINING COMPLETE")


if __name__ == "__main__":
    main()
