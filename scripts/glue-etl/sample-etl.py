"""
Sample AWS Glue ETL Job for SageMaker Unified Studio Data Platform

This script demonstrates a typical ETL workflow:
1. Read raw sales data from S3
2. Perform data transformations and quality checks
3. Join with customer and product data
4. Write enriched data to curated bucket

Usage: This script is designed to run as an AWS Glue Job
"""

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.sql import DataFrame
from pyspark.sql.functions import *
from pyspark.sql.types import *

# Initialize Glue context
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)

# Get job parameters
args = getResolvedOptions(sys.argv, [
    'JOB_NAME',
    'source-bucket', 
    'target-bucket',
    'database-name'
])

job.init(args['JOB_NAME'], args)

# Configuration
SOURCE_BUCKET = args['source_bucket']
TARGET_BUCKET = args['target_bucket'] 
DATABASE_NAME = args['database_name']

print(f"Starting ETL job: {args['JOB_NAME']}")
print(f"Source bucket: {SOURCE_BUCKET}")
print(f"Target bucket: {TARGET_BUCKET}")
print(f"Database: {DATABASE_NAME}")

def read_sales_data():
    """Read sales data from S3"""
    print("Reading sales data...")
    
    # Create dynamic frame from catalog
    sales_df = glueContext.create_dynamic_frame.from_catalog(
        database=DATABASE_NAME,
        table_name="sales",
        transformation_ctx="sales_source"
    ).toDF()
    
    print(f"Sales data rows: {sales_df.count()}")
    return sales_df

def read_customer_data():
    """Read customer data from S3"""
    print("Reading customer data...")
    
    customer_df = glueContext.create_dynamic_frame.from_catalog(
        database=DATABASE_NAME,
        table_name="customers", 
        transformation_ctx="customer_source"
    ).toDF()
    
    print(f"Customer data rows: {customer_df.count()}")
    return customer_df

def read_product_data():
    """Read product data from S3"""
    print("Reading product data...")
    
    product_df = glueContext.create_dynamic_frame.from_catalog(
        database=DATABASE_NAME,
        table_name="products",
        transformation_ctx="product_source"
    ).toDF()
    
    print(f"Product data rows: {product_df.count()}")
    return product_df

def clean_sales_data(sales_df):
    """Clean and validate sales data"""
    print("Cleaning sales data...")
    
    # Remove duplicates
    sales_clean = sales_df.dropDuplicates(['transaction_id'])
    
    # Filter out invalid transactions
    sales_clean = sales_clean.filter(
        (col('total_amount') > 0) & 
        (col('quantity') > 0) &
        (col('transaction_date').isNotNull())
    )
    
    # Add derived columns
    sales_clean = sales_clean.withColumn(
        'transaction_year', 
        year(col('transaction_date'))
    ).withColumn(
        'transaction_month',
        month(col('transaction_date'))
    ).withColumn(
        'transaction_day',
        dayofmonth(col('transaction_date'))
    )
    
    # Calculate discount percentage
    sales_clean = sales_clean.withColumn(
        'discount_percentage',
        round(((col('unit_price') * col('quantity') - col('total_amount')) / 
               (col('unit_price') * col('quantity'))) * 100, 2)
    )
    
    print(f"Cleaned sales data rows: {sales_clean.count()}")
    return sales_clean

def create_enriched_sales(sales_df, customer_df, product_df):
    """Create enriched sales dataset by joining with customer and product data"""
    print("Creating enriched sales dataset...")
    
    # Join with customer data
    enriched_df = sales_df.join(
        customer_df.select('customer_id', 'customer_segment', 'total_lifetime_value'),
        on='customer_id',
        how='left'
    )
    
    # Join with product data  
    enriched_df = enriched_df.join(
        product_df.select('product_id', 'brand', 'stock_quantity', 'supplier'),
        on='product_id', 
        how='left'
    )
    
    # Add business metrics
    enriched_df = enriched_df.withColumn(
        'profit_margin',
        round((col('total_amount') - (col('total_amount') * 0.6)), 2)  # Assuming 60% cost
    ).withColumn(
        'is_high_value_customer',
        when(col('total_lifetime_value') > 2000, True).otherwise(False)
    ).withColumn(
        'order_size_category',
        when(col('total_amount') < 50, 'Small')
        .when(col('total_amount') < 150, 'Medium')
        .otherwise('Large')
    )
    
    print(f"Enriched sales data rows: {enriched_df.count()}")
    return enriched_df

def create_sales_summary(enriched_df):
    """Create daily sales summary"""
    print("Creating sales summary...")
    
    summary_df = enriched_df.groupBy('transaction_date', 'store_location') \
        .agg(
            sum('total_amount').alias('daily_revenue'),
            count('transaction_id').alias('transaction_count'),
            avg('total_amount').alias('avg_order_value'),
            sum('profit_margin').alias('daily_profit'),
            countDistinct('customer_id').alias('unique_customers')
        ) \
        .withColumn('avg_order_value', round(col('avg_order_value'), 2)) \
        .withColumn('daily_profit', round(col('daily_profit'), 2))
    
    print(f"Sales summary rows: {summary_df.count()}")
    return summary_df

def create_customer_insights(enriched_df):
    """Create customer insights"""
    print("Creating customer insights...")
    
    insights_df = enriched_df.groupBy('customer_id', 'customer_segment') \
        .agg(
            sum('total_amount').alias('total_spent'),
            count('transaction_id').alias('order_count'),
            avg('total_amount').alias('avg_order_size'),
            max('transaction_date').alias('last_order_date'),
            countDistinct('category').alias('categories_purchased')
        ) \
        .withColumn('avg_order_size', round(col('avg_order_size'), 2))
    
    print(f"Customer insights rows: {insights_df.count()}")
    return insights_df

def write_to_curated(df, table_name, partition_cols=None):
    """Write DataFrame to curated bucket"""
    print(f"Writing {table_name} to curated bucket...")
    
    output_path = f"s3://{TARGET_BUCKET}/{table_name}/"
    
    # Convert to DynamicFrame for Glue optimizations
    dynamic_frame = DynamicFrame.fromDF(df, glueContext, table_name)
    
    # Write with partitioning if specified
    if partition_cols:
        glueContext.write_dynamic_frame.from_options(
            frame=dynamic_frame,
            connection_type="s3",
            connection_options={
                "path": output_path,
                "partitionKeys": partition_cols
            },
            format="parquet",
            transformation_ctx=f"write_{table_name}"
        )
    else:
        glueContext.write_dynamic_frame.from_options(
            frame=dynamic_frame,
            connection_type="s3", 
            connection_options={"path": output_path},
            format="parquet",
            transformation_ctx=f"write_{table_name}"
        )
    
    print(f"Successfully wrote {table_name}")

def main():
    """Main ETL workflow"""
    try:
        # Read source data
        sales_df = read_sales_data()
        customer_df = read_customer_data() 
        product_df = read_product_data()
        
        # Transform data
        clean_sales = clean_sales_data(sales_df)
        enriched_sales = create_enriched_sales(clean_sales, customer_df, product_df)
        sales_summary = create_sales_summary(enriched_sales)
        customer_insights = create_customer_insights(enriched_sales)
        
        # Write to curated bucket
        write_to_curated(enriched_sales, "enriched_sales", ["transaction_year", "transaction_month"])
        write_to_curated(sales_summary, "sales_summary", ["transaction_date"])
        write_to_curated(customer_insights, "customer_insights")
        
        print("✅ ETL job completed successfully!")
        
        # Print some statistics
        print("\n📊 Data Processing Summary:")
        print(f"  • Processed {clean_sales.count()} sales transactions")
        print(f"  • Created {enriched_sales.count()} enriched records")
        print(f"  • Generated {sales_summary.count()} daily summaries")
        print(f"  • Analyzed {customer_insights.count()} customers")
        
    except Exception as e:
        print(f"❌ ETL job failed: {str(e)}")
        raise e

# Run the ETL job
if __name__ == "__main__":
    main()

job.commit()
