#!/usr/bin/env python3
"""
Training script for ML experiment recommender pipeline.

Trains an XGBoost model to predict experiment uplift based on
experiment configuration features.
"""

import argparse
import os
import shutil
import json
import pandas as pd
import xgboost as xgb
import joblib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_parquet(path):
    """Load a parquet file into a pandas DataFrame."""
    return pd.read_parquet(path)


def main():
    """Train the recommender model."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--train_path", type=str, default="/opt/ml/input/data/training/")
    parser.add_argument("--model_dir", type=str, default="/opt/ml/model/")
    # Hyperparameters (can be overridden by SageMaker)
    parser.add_argument("--max_depth", type=int, default=8)
    parser.add_argument("--eta", type=float, default=0.05)
    parser.add_argument("--subsample", type=float, default=0.8)
    parser.add_argument("--colsample_bytree", type=float, default=0.8)
    parser.add_argument("--num_boost_round", type=int, default=400)
    parser.add_argument("--early_stopping_rounds", type=int, default=20)
    args = parser.parse_args()

    logger.info("Starting recommender model training...")
    logger.info(f"Training data path: {args.train_path}")
    logger.info(f"Model output path: {args.model_dir}")

    # Load training data
    X_train = load_parquet(os.path.join(args.train_path, "X_train.parquet"))
    X_val = load_parquet(os.path.join(args.train_path, "X_val.parquet"))
    y_train = load_parquet(os.path.join(args.train_path, "y_train.parquet"))["uplift_pct"]
    y_val = load_parquet(os.path.join(args.train_path, "y_val.parquet"))["uplift_pct"]

    logger.info(f"Training data shape: {X_train.shape}")
    logger.info(f"Validation data shape: {X_val.shape}")

    # Create DMatrix objects for XGBoost
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)

    params = {
        "max_depth": args.max_depth,
        "eta": args.eta,
        "objective": "reg:squarederror",
        "subsample": args.subsample,
        "colsample_bytree": args.colsample_bytree,
        "eval_metric": "rmse"
    }

    logger.info(f"Training with params: {params}")

    bst = xgb.train(
        params,
        dtrain,
        evals=[(dtrain, "train"), (dval, "val")],
        num_boost_round=args.num_boost_round,
        early_stopping_rounds=args.early_stopping_rounds,
        verbose_eval=50
    )

    # Create model directory
    os.makedirs(args.model_dir, exist_ok=True)

    # Save the model
    model_path = os.path.join(args.model_dir, "model.bst")
    bst.save_model(model_path)
    logger.info(f"Model saved to: {model_path}")

    # Copy feature list from preprocessing to model directory for inference
    feature_list_src = os.path.join(args.train_path, "feature_list.pkl")
    feature_list_dst = os.path.join(args.model_dir, "feature_list.pkl")
    if os.path.exists(feature_list_src):
        shutil.copy(feature_list_src, feature_list_dst)
        logger.info(f"Feature list copied to: {feature_list_dst}")
    else:
        # If feature list doesn't exist, create it from training data
        feature_list = list(X_train.columns)
        joblib.dump(feature_list, feature_list_dst)
        logger.info(f"Feature list created and saved to: {feature_list_dst}")

    # Save training metrics
    metrics = {
        "best_iteration": bst.best_iteration,
        "best_score": float(bst.best_score),
        "num_features": len(X_train.columns),
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
    }
    
    with open(os.path.join(args.model_dir, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    
    logger.info(f"Training metrics: {metrics}")
    logger.info("TRAINING COMPLETE")


if __name__ == "__main__":
    main()
