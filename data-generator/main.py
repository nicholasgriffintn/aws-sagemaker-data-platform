#!/usr/bin/env python3
"""
Unified Data Generator CLI

Generates synthetic data for ML pipelines:
- experiment: Experiment metadata and results for recommender pipeline
- bucketing: User data for experiment bucketing pipeline

Usage:
    python main.py experiment --records 100000
    python main.py bucketing --records 10000
    python main.py all
    python main.py experiment --upload --bucket my-bucket
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generate_data import generate_metadata, generate_results, write_parquet
from user_bucketing import generate_user_bucketing_data, generate_high_value_labels


def generate_experiment_data(num_records: int, output_dir: str):
    """Generate experiment metadata and results for recommender pipeline."""
    out_meta = f"{output_dir}/raw/experiments/metadata"
    out_results = f"{output_dir}/raw/experiments/results"

    print("Generating experiment metadata...")
    meta = generate_metadata(num_records)
    write_parquet(meta, out_meta, "metadata")

    print("Generating experiment results...")
    results = generate_results(meta, multiplier=8)
    write_parquet(results, out_results, "results")

    print(f"Experiment data saved to {output_dir}/raw/experiments/")


def generate_bucketing_data(num_records: int, output_dir: str):
    """Generate user bucketing data for experiment assignment pipeline."""
    out_path = f"{output_dir}/raw/bucketing"
    os.makedirs(out_path, exist_ok=True)

    print("Generating user bucketing data...")
    df = generate_user_bucketing_data(num_records)
    df = generate_high_value_labels(df)

    output_file = f"{out_path}/user_bucketing_data.csv"
    df.to_csv(output_file, index=False)
    print(f"Bucketing data saved to {output_file}")


def upload_to_s3(local_dir: str, bucket: str, prefix: str = ""):
    """Upload generated data to S3."""
    try:
        import boto3
    except ImportError:
        print("Error: boto3 is required for S3 upload. Install with: pip install boto3")
        sys.exit(1)

    s3 = boto3.client('s3')
    
    for root, _, files in os.walk(local_dir):
        for file in files:
            local_path = os.path.join(root, file)
            relative_path = os.path.relpath(local_path, local_dir)
            s3_key = f"{prefix}/{relative_path}" if prefix else relative_path
            
            print(f"Uploading {local_path} -> s3://{bucket}/{s3_key}")
            s3.upload_file(local_path, bucket, s3_key)
    
    print(f"Upload complete to s3://{bucket}/{prefix}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic data for ML pipelines",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py experiment                    # Generate experiment data (1M records)
  python main.py bucketing --records 50000     # Generate 50k user records
  python main.py all                           # Generate both datasets
  python main.py experiment --upload --bucket my-bucket  # Generate and upload to S3
        """
    )
    
    parser.add_argument(
        'type',
        choices=['experiment', 'bucketing', 'all'],
        help='Type of data to generate'
    )
    parser.add_argument(
        '--records', '-n',
        type=int,
        default=None,
        help='Number of records to generate (default: 1M for experiment, 10k for bucketing)'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='output',
        help='Output directory (default: output)'
    )
    parser.add_argument(
        '--upload',
        action='store_true',
        help='Upload generated data to S3'
    )
    parser.add_argument(
        '--bucket',
        type=str,
        help='S3 bucket name for upload'
    )
    parser.add_argument(
        '--prefix',
        type=str,
        default='',
        help='S3 prefix/path for upload'
    )

    args = parser.parse_args()

    if args.upload and not args.bucket:
        parser.error("--bucket is required when using --upload")

    # Set default record counts
    experiment_records = args.records if args.records else 1_000_000
    bucketing_records = args.records if args.records else 10_000

    # Generate data
    if args.type in ('experiment', 'all'):
        generate_experiment_data(experiment_records, args.output)
    
    if args.type in ('bucketing', 'all'):
        generate_bucketing_data(bucketing_records, args.output)

    # Upload to S3 if requested
    if args.upload:
        upload_to_s3(args.output, args.bucket, args.prefix)

    print("\nDONE.")


if __name__ == "__main__":
    main()

