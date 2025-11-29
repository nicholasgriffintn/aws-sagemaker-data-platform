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
    Uses XGBoost for regression to predict uplift percentages.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=str, default=os.environ.get("SM_MODEL_DIR", "/opt/ml/model"))
    parser.add_argument("--train", type=str, default=os.environ.get("SM_CHANNEL_TRAINING", "/opt/ml/input/data/training"))
    parser.add_argument("--validation", type=str, default=os.environ.get("SM_CHANNEL_VALIDATION", "/opt/ml/input/data/validation"))
    parser.add_argument("--max_depth", type=int, default=8)
    parser.add_argument("--eta", type=float, default=0.05)
    parser.add_argument("--subsample", type=float, default=0.8)
    parser.add_argument("--colsample_bytree", type=float, default=0.8)
    parser.add_argument("--num_boost_round", type=int, default=400)
    parser.add_argument("--early_stopping_rounds", type=int, default=20)
    args = parser.parse_args()

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

    y_pred = bst.predict(dval)
    
    metrics_tracker = MetricsTracker(logger)
    regression_metrics = metrics_tracker.compute_regression_metrics(y_val, y_pred)

    metrics = {
        **regression_metrics,
        "best_iteration": bst.best_iteration,
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
