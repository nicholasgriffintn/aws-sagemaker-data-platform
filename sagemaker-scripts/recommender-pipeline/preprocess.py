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

from platform_shared import setup_logging

logger = setup_logging(__name__)


def load_parquet_files(directory):
    """Load all parquet files from a directory into a single DataFrame."""
    parquet_files = glob.glob(os.path.join(directory, "**/*.parquet"), recursive=True)
    
    if not parquet_files:
        if os.path.isfile(directory):
            return pq.read_table(directory).to_pandas()
        raise FileNotFoundError(f"No parquet files found in {directory}")
    
    dfs = []
    for f in parquet_files:
        logger.info(f"Loading: {f}")
        dfs.append(pq.read_table(f).to_pandas())
    
    return pd.concat(dfs, ignore_index=True)


def numeric_cast(df):
    """
    Convert boolean and categorical columns to numeric.
    
    XGBoost requires numeric input. This function:
    - Drops timestamp columns (not useful as-is, would need feature engineering)
    - Converts booleans to 0/1 integers
    - Converts categorical strings to numeric codes (similar to LabelEncoder)
    
    Note: For categorical features with many categories, consider:
    - One-hot encoding for low-cardinality categories (<10 unique values)
    - Target encoding for high-cardinality categories
    - Keeping as numeric codes (current approach) works but loses category relationships
    """
    df = df.copy()
    drop_cols = [c for c in df.columns if c in ['processed_at', 'created_at', 'updated_at', 'timestamp']]
    if drop_cols:
        df = df.drop(columns=drop_cols)

    for col in df.columns:
        if df[col].dtype == "bool":
            # Convert True/False to 1/0
            df[col] = df[col].astype("int32")
        elif df[col].dtype == "object":
            # Convert categorical strings to numeric codes
            # Each unique string gets a unique integer (0, 1, 2, ...)
            # XGBoost can handle this, but be aware it treats codes as ordinal
            df[col] = df[col].astype("category").cat.codes
    return df


def main():
    """Preprocess experiment data for recommender model training."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_path", type=str, default="/opt/ml/processing/input")
    parser.add_argument("--train_path", type=str, default="/opt/ml/processing/train")
    parser.add_argument("--validation_path", type=str, default="/opt/ml/processing/validation")
    parser.add_argument("--test_path", type=str, default="/opt/ml/processing/test")
    parser.add_argument("--test_size", type=float, default=0.2)
    parser.add_argument("--random_state", type=int, default=42)
    args = parser.parse_args()

    logger.info(f"Input path: {args.input_path}")

    logger.info("Loading experiment results data...")
    df = load_parquet_files(args.input_path)
    logger.info(f"Loaded {len(df)} records")

    logger.info("Casting categorical columns to numeric...")
    df = numeric_cast(df)

    if "uplift_pct" not in df.columns:
        if "avg_uplift_pct" in df.columns:
            df = df.rename(columns={"avg_uplift_pct": "uplift_pct"})
        else:
            raise ValueError("Target column 'uplift_pct' or 'avg_uplift_pct' not found in data")

    y = df["uplift_pct"]
    X = df.drop(columns=["uplift_pct"])

    logger.info(f"Features: {list(X.columns)}")
    logger.info(f"Target stats: mean={y.mean():.4f}, std={y.std():.4f}")

    logger.info("Splitting into train/validation/test sets...")
    # Three-way split: train (60%), validation (20%), test (20%)
    # - Training: Used to fit the model
    # - Validation: Used for early stopping and hyperparameter tuning (not used here but available)
    # - Test: Held out for final evaluation only (unbiased performance estimate)
    # 
    # Note: For time-series data, use time-based splits instead of random splits
    # to avoid data leakage from future to past
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.random_state
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=0.25, random_state=args.random_state
    )

    logger.info(f"Training set: {len(X_train)} samples")
    logger.info(f"Validation set: {len(X_val)} samples")
    logger.info(f"Test set: {len(X_test)} samples")

    for path in [args.train_path, args.validation_path, args.test_path]:
        os.makedirs(path, exist_ok=True)

    logger.info("Saving preprocessed data...")
    # Training data
    train_df = X_train.copy()
    train_df["target"] = y_train.values
    train_df.to_csv(os.path.join(args.train_path, "train.csv"), index=False)
    
    # Validation data  
    val_df = X_val.copy()
    val_df["target"] = y_val.values
    val_df.to_csv(os.path.join(args.validation_path, "validation.csv"), index=False)
    
    # Test data
    test_df = X_test.copy()
    test_df["target"] = y_test.values
    test_df.to_csv(os.path.join(args.test_path, "test.csv"), index=False)

    feature_list = list(X.columns)
    joblib.dump(feature_list, os.path.join(args.train_path, "feature_list.pkl"))
    logger.info(f"Feature list saved: {feature_list}")

    logger.info("PREPROCESS COMPLETE")


if __name__ == "__main__":
    main()
