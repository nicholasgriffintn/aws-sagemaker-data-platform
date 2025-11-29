import argparse
import os
import pandas as pd
import xgboost as xgb

def load_parquet(path):
    return pd.read_parquet(path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--train_path", type=str, default="/opt/ml/input/data/training/")
    parser.add_argument("--model_dir", type=str, default="/opt/ml/model/")
    args = parser.parse_args()

    X_train = load_parquet(os.path.join(args.train_path, "X_train.parquet"))
    X_val = load_parquet(os.path.join(args.train_path, "X_val.parquet"))
    y_train = load_parquet(os.path.join(args.train_path, "y_train.parquet"))["uplift_pct"]
    y_val = load_parquet(os.path.join(args.train_path, "y_val.parquet"))["uplift_pct"]

    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)

    params = {
        "max_depth": 8,
        "eta": 0.05,
        "objective": "reg:squarederror",
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "eval_metric": "rmse"
    }

    bst = xgb.train(
        params,
        dtrain,
        evals=[(dtrain, "train"), (dval, "val")],
        num_boost_round=400,
        early_stopping_rounds=20
    )

    os.makedirs(args.model_dir, exist_ok=True)
    model_path = os.path.join(args.model_dir, "model.bst")
    bst.save_model(model_path)

    print(f"Model saved to: {model_path}")

if __name__ == "__main__":
    main()
