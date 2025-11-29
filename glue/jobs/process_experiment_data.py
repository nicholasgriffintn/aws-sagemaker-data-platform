"""
Glue ETL Job: Process Experiment Data

Reads raw experiment metadata and results from the raw S3 bucket,
joins and aggregates the data, and writes processed data for the
recommender pipeline.

Input: s3://<raw-bucket>/raw/experiments/metadata/ and s3://<raw-bucket>/raw/experiments/results/
Output: s3://<processed-bucket>/recommender-pipeline/data/
"""
import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.sql import functions as F
from pyspark.sql.window import Window

args = getResolvedOptions(sys.argv, [
    'JOB_NAME',
    'raw_bucket',
    'processed_bucket',
    'raw_database',
    'processed_database'
])

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

RAW_METADATA_PATH = f"s3://{args['raw_bucket']}/raw/experiments/metadata/"
RAW_RESULTS_PATH = f"s3://{args['raw_bucket']}/raw/experiments/results/"
OUTPUT_PATH = f"s3://{args['processed_bucket']}/recommender-pipeline/data/"

print(f"Reading metadata from: {RAW_METADATA_PATH}")
print(f"Reading results from: {RAW_RESULTS_PATH}")

metadata_df = spark.read.parquet(RAW_METADATA_PATH)
results_df = spark.read.parquet(RAW_RESULTS_PATH)

print(f"Metadata count: {metadata_df.count()}")
print(f"Results count: {results_df.count()}")

joined_df = results_df.join(
    metadata_df,
    on="experiment_id",
    how="inner"
)

aggregated_df = joined_df.groupBy(
    "experiment_id",
    "name",
    "description",
    "surface",
    "platform",
    "content_scope",
    "experiment_type",
    "target_age_band",
    "target_region",
    "target_device",
    "start_datetime",
    "end_datetime",
    "num_variants"
).agg(
    F.count("*").alias("total_observations"),
    F.sum("sample_size").alias("total_sample_size"),
    F.avg("uplift_pct").alias("avg_uplift_pct"),
    F.stddev("uplift_pct").alias("stddev_uplift_pct"),
    F.avg("z_score").alias("avg_z_score"),
    F.max("z_score").alias("max_z_score"),
    F.min("z_score").alias("min_z_score"),
    F.avg("metric_value").alias("avg_metric_value"),
    F.avg("control_value").alias("avg_control_value"),
    F.countDistinct("metric_name").alias("num_metrics"),
    F.countDistinct("segment").alias("num_segments")
)

aggregated_df = aggregated_df.withColumn(
    "experiment_duration_days",
    F.datediff(
        F.to_timestamp(F.col("end_datetime")),
        F.to_timestamp(F.col("start_datetime"))
    )
)

aggregated_df = aggregated_df.withColumn(
    "is_significant",
    F.when(F.abs(F.col("avg_z_score")) > 1.96, 1).otherwise(0)
)

aggregated_df = aggregated_df.withColumn(
    "is_successful",
    F.when(
        (F.col("is_significant") == 1) & (F.col("avg_uplift_pct") > 0),
        1
    ).otherwise(0)
)

aggregated_df = aggregated_df \
    .withColumn(
        "experiment_size",
        F.when(F.col("total_sample_size") < 10000, "small")
        .when(F.col("total_sample_size") < 100000, "medium")
        .otherwise("large")
    ) \
    .withColumn(
        "experiment_length",
        F.when(F.col("experiment_duration_days") < 7, "short")
        .when(F.col("experiment_duration_days") < 21, "medium")
        .otherwise("long")
    )

processed_df = aggregated_df \
    .withColumn("processed_at", F.current_timestamp()) \
    .withColumn("data_version", F.lit("1.0"))

print(f"Processed experiments count: {processed_df.count()}")
print(f"Successful experiments: {processed_df.filter(F.col('is_successful') == 1).count()}")

print(f"Writing processed data to: {OUTPUT_PATH}")

processed_df.write \
    .mode("overwrite") \
    .parquet(OUTPUT_PATH)

print("ETL job completed successfully")

job.commit()

