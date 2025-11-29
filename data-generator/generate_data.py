import polars as pl
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
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
    print(f"Generating {n} experiment metadata rows…")

    start_dates = np.array([
        fake.date_time_between(start_date="-800d", end_date="now")
        for _ in range(n)
    ])

    df = pl.DataFrame({
        "experiment_id": np.arange(n),
        "name": [f"Exp {i}" for i in range(n)],
        "description": fake.sentences(nb=n),
        "surface": np.random.choice(SURFACES, n),
        "platform": np.random.choice(PLATFORMS, n),
        "content_scope": np.random.choice(CONTENT_SCOPE, n),
        "experiment_type": np.random.choice(EXPERIMENT_TYPES, n),
        "target_age_band": np.random.choice(AGE_BANDS, n),
        "target_region": np.random.choice(REGIONS, n),
        "target_device": np.random.choice(DEVICES, n),
        "start_datetime": start_dates,
        "end_datetime": [
            dt + timedelta(days=np.random.randint(7, 40))
            for dt in start_dates
        ],
        "num_variants": np.random.randint(2, 4, n)
    })

    return df

def generate_results(metadata: pl.DataFrame, multiplier: int = 10):
    n = metadata.height
    print(f"Generating ~{n*multiplier:,} experiment result rows…")

    exp_ids = np.repeat(metadata["experiment_id"], multiplier)

    variants = np.random.choice(["control", "treatment"], n * multiplier)
    segments = np.random.choice(AGE_BANDS, n * multiplier)

    metrics = np.random.choice(METRICS, n * multiplier)
    sample_sizes = np.random.randint(500, 5000, n * multiplier)

    control_values = np.abs(np.random.normal(50, 20, n * multiplier))
    uplift = np.random.normal(0.02, 0.05, n * multiplier)

    treatment_values = control_values * (1 + uplift)

    df = pl.DataFrame({
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

def write_parquet(df: pl.DataFrame, path: str, prefix: str, chunk=250_000):
    ensure(path)
    total = df.height // chunk + 1
    for i in range(total):
        slice_df = df[i * chunk : (i + 1) * chunk]
        if slice_df.is_empty():
            continue
        pq.write_table(
            slice_df.to_arrow(),
            f"{path}/{prefix}-part-{i:05}.snappy.parquet",
            compression="snappy"
        )

def main():
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
