#!/usr/bin/env python3
"""
Preprocessing script for ML experiment recommender pipeline.

Transforms raw experiment data into features suitable for training
an uplift prediction model.
"""

import argparse
import os
import glob
import pandas as pd
import pyarrow.parquet as pq
from sklearn.model_selection import train_test_split
import joblib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_parquet_files(directory):
    """Load all parquet files from a directory into a single DataFrame."""
    parquet_files = glob.glob(os.path.join(directory, "**/*.parquet"), recursive=True)
    
    if not parquet_files:
        # Try direct path if no files found in directory
        if os.path.isfile(directory):
            return pq.read_table(directory).to_pandas()
        raise FileNotFoundError(f"No parquet files found in {directory}")
    
    dfs = []
    for f in parquet_files:
        logger.info(f"Loading: {f}")
        dfs.append(pq.read_table(f).to_pandas())
    
    return pd.concat(dfs, ignore_index=True)


def numeric_cast(df):
    """Convert boolean and categorical columns to numeric."""
    df = df.copy()
    for col in df.columns:
        if df[col].dtype == "bool":
            df[col] = df[col].astype("int32")
        elif df[col].dtype == "object":
            df[col] = df[col].astype("category").cat.codes
    return df


def main():
    """Preprocess experiment data for recommender model training."""
    parser = argparse.ArgumentParser()
    # SageMaker standard paths
    parser.add_argument("--input_path", type=str, 
                        default=os.environ.get("SM_CHANNEL_TRAINING", "/opt/ml/processing/input"))
    parser.add_argument("--output_path", type=str, 
                        default="/opt/ml/processing/train")
    parser.add_argument("--test_size", type=float, default=0.2)
    parser.add_argument("--random_state", type=int, default=42)
    args = parser.parse_args()

    logger.info(f"Input path: {args.input_path}")
    logger.info(f"Output path: {args.output_path}")

    logger.info("Loading experiment results data...")
    df = load_parquet_files(args.input_path)
    logger.info(f"Loaded {len(df)} records")

    logger.info("Casting categorical columns to numeric...")
    df = numeric_cast(df)

    # Check for target column
    if "uplift_pct" not in df.columns:
        raise ValueError("Target column 'uplift_pct' not found in data")

    y = df["uplift_pct"]
    X = df.drop(columns=["uplift_pct"])

    logger.info(f"Features: {list(X.columns)}")
    logger.info(f"Target stats: mean={y.mean():.4f}, std={y.std():.4f}")

    logger.info("Splitting into train/validation sets...")
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=args.test_size, random_state=args.random_state
    )

    logger.info(f"Training set: {len(X_train)} samples")
    logger.info(f"Validation set: {len(X_val)} samples")

    os.makedirs(args.output_path, exist_ok=True)

    logger.info("Saving preprocessed data...")
    X_train.to_parquet(os.path.join(args.output_path, "X_train.parquet"))
    X_val.to_parquet(os.path.join(args.output_path, "X_val.parquet"))
    y_train.to_frame("uplift_pct").to_parquet(os.path.join(args.output_path, "y_train.parquet"))
    y_val.to_frame("uplift_pct").to_parquet(os.path.join(args.output_path, "y_val.parquet"))

    # Save feature list for inference
    feature_list = list(X.columns)
    joblib.dump(feature_list, os.path.join(args.output_path, "feature_list.pkl"))
    logger.info(f"Feature list saved: {feature_list}")

    logger.info("PREPROCESS COMPLETE")


if __name__ == "__main__":
    main()
