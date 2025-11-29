import sys
import pyspark.sql.functions as F
from pyspark.sql import SparkSession
from pyspark.sql.types import *
from datetime import datetime

spark = SparkSession.builder.appName("MLFeatureETL").getOrCreate()

args = sys.argv

def parse_args(args):
    result = {}
    for i in range(len(args)):
        if args[i].startswith("--"):
            result[args[i][2:]] = args[i+1]
    return result

params = parse_args(args)
raw_bucket = params["raw_bucket"]
out_bucket = params["out_bucket"]

# Load the raw experiment metadata and results from S3
metadata = spark.read.parquet(f"{raw_bucket}/metadata/")
results = spark.read.parquet(f"{raw_bucket}/results/")

# Join metadata and results on experiment_id
df = results.join(
    metadata,
    on="experiment_id",
    how="inner"
)

# Derived Time Features
df = (
    df
    .withColumn("start_ts", F.to_timestamp("start_datetime"))
    .withColumn("duration_days",
        F.datediff(F.to_timestamp("end_datetime"), F.to_timestamp("start_datetime"))
    )
    .withColumn("start_hour_of_day", F.hour("start_ts"))
    .withColumn("start_day_of_week", F.date_format("start_ts", "u").cast("int"))
    .withColumn("start_month", F.month("start_ts"))
    .withColumn("season",
        F.when(F.col("start_month").isin([12, 1, 2]), F.lit("winter"))
         .when(F.col("start_month").isin([3, 4, 5]), F.lit("spring"))
         .when(F.col("start_month").isin([6, 7, 8]), F.lit("summer"))
         .otherwise(F.lit("autumn"))
    )
)

# Derived Boolean Features
df = (
    df
    .withColumn("is_personalised",
        F.col("experiment_type") == F.lit("personalisation")
    )
    .withColumn("is_algorithm_change",
        F.col("experiment_type") == F.lit("recommendation_algo_change")
    )
    .withColumn("is_copy_only",
        F.col("experiment_type") == F.lit("copy_test")
    )
    .withColumn("uses_notifications",
        F.col("experiment_type") == F.lit("notification_timing")
    )
)

# Age Band Encoding
age_band_index = (
    df.select("segment").distinct().rdd
    .map(lambda r: r["segment"])
    .zipWithIndex()
    .collect()
)
age_index_map = dict(age_band_index)

mapping_expr = F.create_map(
    *[F.lit(k) if i % 2 == 0 else F.lit(v)
      for i, kv in enumerate(sum(age_index_map.items(), ())) for k, v in age_index_map.items()]
)

df = df.withColumn("segment_encoded", mapping_expr[F.col("segment")])

# Label Calculation: Uplift Percentage
df = (
    df
    .withColumn("uplift_pct", F.col("uplift_pct"))  # already present
    .withColumn("uplift_abs", F.col("metric_value") - F.col("control_value"))
)

# Select final columns for model training
final_cols = [
    # Label
    "uplift_pct",

    # Numeric experiment design
    "num_variants", "duration_days",

    # Context
    "start_hour_of_day",
    "start_day_of_week",
    "start_month",

    # Categoricals
    "surface", "platform", "content_scope", "experiment_type",
    "segment_encoded",

    # Booleans
    "is_personalised",
    "is_algorithm_change",
    "is_copy_only",
    "uses_notifications",
]

out = df.select(*final_cols)

# Write the processed features to S3
(
    out.repartition(200)
       .write
       .mode("overwrite")
       .parquet(out_bucket)
)

print("ETL COMPLETE")
