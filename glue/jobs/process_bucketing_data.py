"""
Glue ETL Job: Process User Bucketing Data

Reads raw user data from the raw S3 bucket, performs feature engineering,
and writes processed data to the processed S3 bucket for ML training.

Input: s3://<raw-bucket>/bucketing/
Output: s3://<processed-bucket>/bucketing-pipeline/data/
"""
import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.dynamicframe import DynamicFrame
from pyspark.sql import functions as F
from pyspark.sql.types import StringType

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

RAW_PATH = f"s3://{args['raw_bucket']}/bucketing/"
OUTPUT_PATH = f"s3://{args['processed_bucket']}/bucketing-pipeline/data/"

AGE_BINS = [0, 25, 35, 50, 100]
AGE_LABELS = ['young', 'adult', 'middle_aged', 'senior']

SPENDING_BINS = [0, 100, 500, 1000, float('inf')]
SPENDING_LABELS = ['none', 'low', 'medium', 'high']


def assign_age_group(age):
    """Assign age group based on age."""
    if age is None:
        return 'unknown'
    if age < 25:
        return 'young'
    elif age < 35:
        return 'adult'
    elif age < 50:
        return 'middle_aged'
    else:
        return 'senior'


def assign_spending_tier(total_spent):
    """Assign spending tier based on total spent."""
    if total_spent is None:
        return 'none'
    if total_spent < 100:
        return 'none'
    elif total_spent < 500:
        return 'low'
    elif total_spent < 1000:
        return 'medium'
    else:
        return 'high'


assign_age_group_udf = F.udf(assign_age_group, StringType())
assign_spending_tier_udf = F.udf(assign_spending_tier, StringType())

print(f"Reading raw data from: {RAW_PATH}")

raw_df = spark.read.option("header", "true").option("inferSchema", "true").csv(RAW_PATH)

print(f"Raw data count: {raw_df.count()}")
print(f"Raw schema: {raw_df.schema}")

processed_df = raw_df \
    .withColumn(
        "spend_per_purchase",
        F.when(F.col("purchase_history") > 0, 
               F.col("total_spent") / F.col("purchase_history"))
        .otherwise(0)
    ) \
    .withColumn(
        "session_efficiency",
        F.col("page_views") / F.greatest(F.col("session_count"), F.lit(1))
    ) \
    .withColumn(
        "age_group",
        assign_age_group_udf(F.col("age"))
    ) \
    .withColumn(
        "spending_tier",
        assign_spending_tier_udf(F.col("total_spent"))
    )

engagement_quantile = processed_df.approxQuantile("engagement_score", [0.75], 0.01)[0]
spending_quantile = processed_df.approxQuantile("total_spent", [0.75], 0.01)[0]

processed_df = processed_df.withColumn(
    "high_value_user",
    F.when(
        (F.col("engagement_score") > engagement_quantile) & 
        (F.col("total_spent") > spending_quantile),
        1
    ).otherwise(0)
)

processed_df = processed_df \
    .withColumn("processed_at", F.current_timestamp()) \
    .withColumn("data_version", F.lit("1.0"))

print(f"Processed data count: {processed_df.count()}")
print(f"High value users: {processed_df.filter(F.col('high_value_user') == 1).count()}")

print(f"Writing processed data to: {OUTPUT_PATH}")

processed_df.write \
    .mode("overwrite") \
    .option("header", "true") \
    .csv(OUTPUT_PATH)

parquet_path = OUTPUT_PATH.replace("/data/", "/parquet/")
processed_df.write \
    .mode("overwrite") \
    .parquet(parquet_path)

print("ETL job completed successfully")

job.commit()

