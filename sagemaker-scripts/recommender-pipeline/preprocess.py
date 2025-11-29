import argparse
import os
import pandas as pd
import pyarrow.parquet as pq
from sklearn.model_selection import train_test_split
import joblib

def load_parquet_from_s3(path):
    return pq.read_table(path).to_pandas()

def numeric_cast(df):
    for col in df.columns:
        if df[col].dtype == "bool":
            df[col] = df[col].astype("int32")
        if df[col].dtype == "object":
            df[col] = df[col].astype("category").cat.codes
    return df

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_path", type=str)
    parser.add_argument("--output_path", type=str)
    args = parser.parse_args()

    print("Loading features…")
    df = load_parquet_from_s3(args.input_path)

    print("Casting categoricals…")
    df = numeric_cast(df)

    y = df["uplift_pct"]
    X = df.drop(columns=["uplift_pct"])

    print("Splitting train/val…")
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    os.makedirs(args.output_path, exist_ok=True)

    print("Saving preprocessed data…")
    X_train.to_parquet(os.path.join(args.output_path, "X_train.parquet"))
    X_val.to_parquet(os.path.join(args.output_path, "X_val.parquet"))
    y_train.to_frame("uplift_pct").to_parquet(os.path.join(args.output_path, "y_train.parquet"))
    y_val.to_frame("uplift_pct").to_parquet(os.path.join(args.output_path, "y_val.parquet"))

    joblib.dump(list(X.columns), os.path.join(args.output_path, "feature_list.pkl"))

    print("PREPROCESS COMPLETE")

if __name__ == "__main__":
    main()
