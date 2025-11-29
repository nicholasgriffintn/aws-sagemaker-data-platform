import pandas as pd
import numpy as np
from faker import Faker
from datetime import timedelta
import os
from schemas import (
    SURFACES, PLATFORMS, CONTENT_SCOPE,
    EXPERIMENT_TYPES, AGE_BANDS, REGIONS,
    DEVICES, METRICS
)

fake = Faker()

def ensure(path):
    os.makedirs(path, exist_ok=True)

def generate_metadata(n: int = 1_000_000):
    """
    Generate metadata for experiments.

    Args:
        n: Number of experiments to generate.

    Returns:
        DataFrame containing experiment metadata.
    """
    print(f"Generating {n} experiment metadata rows…")

    start_dates = [
        fake.date_time_between(start_date="-800d", end_date="now")
        for _ in range(n)
    ]
    
    end_dates = [
        dt + timedelta(days=np.random.randint(7, 40))
        for dt in start_dates
    ]

    df = pd.DataFrame({
        "experiment_id": np.arange(n),
        "name": [f"Exp {i}" for i in range(n)],
        "description": [fake.sentence() for _ in range(n)],
        "surface": np.random.choice(SURFACES, n),
        "platform": np.random.choice(PLATFORMS, n),
        "content_scope": np.random.choice(CONTENT_SCOPE, n),
        "experiment_type": np.random.choice(EXPERIMENT_TYPES, n),
        "target_age_band": np.random.choice(AGE_BANDS, n),
        "target_region": np.random.choice(REGIONS, n),
        "target_device": np.random.choice(DEVICES, n),
        "start_datetime": [dt.strftime('%Y-%m-%d %H:%M:%S') for dt in start_dates],
        "end_datetime": [dt.strftime('%Y-%m-%d %H:%M:%S') for dt in end_dates],
        "num_variants": np.random.randint(2, 4, n)
    })

    return df

def generate_results(metadata: pd.DataFrame, multiplier: int = 10):
    """
    Generate results for experiments.

    Args:
        metadata: DataFrame containing experiment metadata.
        multiplier: Number of times to repeat each experiment.

    Returns:
        DataFrame containing experiment results.
    """
    n = len(metadata)
    print(f"Generating ~{n*multiplier:,} experiment result rows…")

    exp_ids = np.repeat(metadata["experiment_id"].values, multiplier)

    variants = np.random.choice(["control", "treatment"], n * multiplier)
    segments = np.random.choice(AGE_BANDS, n * multiplier)

    metrics = np.random.choice(METRICS, n * multiplier)
    sample_sizes = np.random.randint(500, 5000, n * multiplier)

    control_values = np.abs(np.random.normal(50, 20, n * multiplier))
    uplift = np.random.normal(0.02, 0.05, n * multiplier)

    treatment_values = control_values * (1 + uplift)

    df = pd.DataFrame({
        "experiment_id": exp_ids,
        "variant_id": variants,
        "segment": segments,
        "metric_name": metrics,
        "metric_value": treatment_values,
        "control_value": control_values,
        "sample_size": sample_sizes,
        "uplift_pct": uplift * 100,
        "z_score": uplift / 0.01
    })

    return df

def write_parquet(df: pd.DataFrame, path: str, prefix: str, chunk: int = 250_000):
    """
    Write a DataFrame to Parquet files.

    Args:
        df: DataFrame to write.
        path: Path to write the files.
        prefix: Prefix for the file names.
        chunk: Number of rows to write in each chunk.
    """
    ensure(path)
    total = len(df) // chunk + 1
    for i in range(total):
        slice_df = df.iloc[i * chunk : (i + 1) * chunk]
        if len(slice_df) == 0:
            continue
        output_path = f"{path}/{prefix}-part-{i:05}.snappy.parquet"
        slice_df.to_parquet(output_path, engine='pyarrow', compression='snappy')

def main():
    """
    Generate data for experiments and bucketing.
    """
    out_meta = "output/raw/experiments/metadata"
    out_results = "output/raw/experiments/results"

    print("Generating metadata…")
    meta = generate_metadata(1_000_000)
    write_parquet(meta, out_meta, "metadata")

    print("Generating results…")
    results = generate_results(meta, multiplier=8)
    write_parquet(results, out_results, "results")

    print("DONE.")

if __name__ == "__main__":
    main()
