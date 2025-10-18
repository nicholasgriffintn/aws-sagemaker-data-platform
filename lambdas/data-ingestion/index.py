import json
import boto3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import io
import urllib.request
import zipfile
import random
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

s3 = boto3.client('s3')

def handler(event, context):
    """
    Lambda handler for data ingestion and preprocessing
    """
    bucket_name = os.environ['RAW_DATA_BUCKET']
    
    try:
        logger.info("Starting data ingestion process...")
        
        dataset_type = event.get('dataset_type', os.environ.get('DEFAULT_DATASET_TYPE', 'amazon-reviews'))
        logger.info(f"Using dataset type: {dataset_type}")
        
        if dataset_type == 'synthetic':
            data = generate_user_bucketing_data()
        else:
            data = download_public_dataset(dataset_type)
        
        csv_buffer = io.StringIO()
        data.to_csv(csv_buffer, index=False)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        key = f'experiment-data/user-bucketing-data-{timestamp}.csv'
        
        s3.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=csv_buffer.getvalue(),
            ServerSideEncryption='aws:kms',
            SSEKMSKeyId=os.environ['KMS_KEY_ID']
        )
        
        logger.info(f"Successfully uploaded data to s3://{bucket_name}/{key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Data ingestion completed successfully',
                'data_location': f's3://{bucket_name}/{key}',
                'records_generated': len(data),
                'timestamp': timestamp
            })
        }
        
    except Exception as e:
        logger.error(f"Error in data ingestion: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def generate_user_bucketing_data(num_users=10000):
    """
    Generate realistic user data for experiment bucketing
    
    This function creates synthetic user data that mimics real-world patterns
    for A/B testing and experiment bucketing scenarios.
    """
    logger.info(f"Generating {num_users} user records...")
    
    # User demographics
    user_ids = [f'user_{i:06d}' for i in range(num_users)]
    ages = np.random.normal(35, 12, num_users).astype(int)
    ages = np.clip(ages, 18, 80)
    
    genders = np.random.choice(['M', 'F', 'Other'], num_users, p=[0.48, 0.48, 0.04])
    locations = np.random.choice(['US', 'UK', 'CA', 'AU', 'DE', 'FR'], num_users, 
                                p=[0.4, 0.15, 0.1, 0.1, 0.15, 0.1])
    
    # Behavioral features
    session_count = np.random.poisson(15, num_users)
    avg_session_duration = np.random.exponential(300, num_users)  # seconds
    page_views = np.random.poisson(25, num_users)
    
    # Purchase behavior
    purchase_history = np.random.poisson(3, num_users)
    total_spent = np.random.exponential(200, num_users) * (purchase_history > 0)
    
    # Engagement scores (derived feature)
    engagement_score = (
        0.3 * np.log1p(session_count) +
        0.2 * np.log1p(avg_session_duration / 60) +
        0.3 * np.log1p(page_views) +
        0.2 * np.log1p(total_spent)
    )
    engagement_score = (engagement_score - engagement_score.min()) / (engagement_score.max() - engagement_score.min())
    
    # Historical experiment assignments
    previous_experiments = []
    conversion_rates = []
    
    for i in range(num_users):
        # Simulate 0-3 previous experiments
        num_prev_exp = np.random.poisson(1)
        prev_exp = []
        conv_rate = 0.0
        
        for _ in range(num_prev_exp):
            exp_name = f'exp_{random.randint(1, 10)}'
            variant = random.choice(['A', 'B', 'C'])
            converted = random.choice([True, False])
            prev_exp.append(f'{exp_name}:{variant}:{converted}')
            if converted:
                conv_rate += 1
        
        if num_prev_exp > 0:
            conv_rate /= num_prev_exp
            
        previous_experiments.append('|'.join(prev_exp))
        conversion_rates.append(conv_rate)
    
    df = pd.DataFrame({
        'user_id': user_ids,
        'age': ages,
        'gender': genders,
        'location': locations,
        'session_count': session_count,
        'avg_session_duration': avg_session_duration,
        'page_views': page_views,
        'purchase_history': purchase_history,
        'total_spent': total_spent,
        'engagement_score': engagement_score,
        'previous_experiments': previous_experiments,
        'historical_conversion_rate': conversion_rates,
        'created_at': datetime.now().isoformat()
    })
    
    logger.info(f"Generated dataset with {len(df)} records and {len(df.columns)} features")
    return df

def download_public_dataset(dataset_name="amazon-reviews"):
    """
    Download and preprocess public datasets for experiment bucketing
    
    Uses AWS Open Data datasets that are relevant for user behavior analysis:
    - Amazon Customer Reviews (for user engagement patterns)
    - NYC Taxi Data (for user behavior modeling)
    - COVID-19 Data Lake (for demographic analysis)
    """
    try:
        if dataset_name == "amazon-reviews":
            return download_amazon_reviews_sample()
        elif dataset_name == "synthetic":
            return generate_user_bucketing_data()
        else:
            logger.warning(f"Unknown dataset: {dataset_name}, falling back to synthetic data")
            return generate_user_bucketing_data()
    except Exception as e:
        logger.error(f"Error downloading {dataset_name}: {str(e)}, falling back to synthetic data")
        return generate_user_bucketing_data()

def download_amazon_reviews_sample():
    """
    Download and process Amazon Customer Reviews data from AWS Open Data
    Transform it into user bucketing format for experiment assignment
    """
    import gzip
    from urllib.parse import urlparse
    
    logger.info("Downloading Amazon Customer Reviews sample from AWS Open Data...")
    
    # This is from the AWS Open Data program: https://registry.opendata.aws/amazon-reviews/
    sample_url = "https://s3.amazonaws.com/amazon-reviews-pds/tsv/amazon_reviews_us_Digital_Software_v1_00.tsv.gz"
    
    try:
        response = urllib.request.urlopen(sample_url)
        
        with gzip.open(response, 'rt', encoding='utf-8') as f:
            lines = []
            header = f.readline().strip().split('\t')
            
            for i, line in enumerate(f):
                if i >= 10000:  # Limit sample size
                    break
                lines.append(line.strip().split('\t'))
        
        df_reviews = pd.DataFrame(lines, columns=header)
        
        return transform_amazon_reviews_to_user_data(df_reviews)
        
    except Exception as e:
        logger.error(f"Failed to download Amazon reviews data: {str(e)}")
        return generate_user_bucketing_data()

def transform_amazon_reviews_to_user_data(df_reviews):
    """
    Transform Amazon reviews data into user bucketing format
    """
    logger.info("Transforming Amazon reviews data for user bucketing...")
    
    user_profiles = []
    
    unique_customers = df_reviews['customer_id'].unique()[:5000]
    
    for customer_id in unique_customers:
        if pd.isna(customer_id) or customer_id == '':
            continue
            
        customer_reviews = df_reviews[df_reviews['customer_id'] == customer_id]
        
        # Extract user features from review behavior
        try:
            num_reviews = len(customer_reviews)
            avg_rating = pd.to_numeric(customer_reviews['star_rating'], errors='coerce').mean()
            
            # Calculate engagement metrics
            total_helpful_votes = pd.to_numeric(customer_reviews['helpful_votes'], errors='coerce').sum()
            total_votes = pd.to_numeric(customer_reviews['total_votes'], errors='coerce').sum()
            
            # Review length as engagement indicator
            review_lengths = customer_reviews['review_body'].fillna('').str.len()
            avg_review_length = review_lengths.mean()
            
            # Verified purchase ratio
            verified_purchases = (customer_reviews['verified_purchase'] == 'Y').sum()
            verified_ratio = verified_purchases / num_reviews if num_reviews > 0 else 0
            
            # Create synthetic demographic data based on review patterns
            # High engagement users tend to be different demographics
            engagement_score = (
                0.3 * min(num_reviews / 10, 1) +  # Review frequency
                0.2 * (avg_rating / 5) +  # Rating positivity
                0.2 * min(avg_review_length / 500, 1) +  # Review detail
                0.3 * verified_ratio  # Purchase verification
            )
            
            # Derive synthetic demographics from engagement patterns
            age = int(25 + engagement_score * 40 + np.random.normal(0, 5))  # 25-65 range
            age = max(18, min(80, age))
            
            # Higher engagement users more likely to be certain demographics
            gender = np.random.choice(['M', 'F', 'Other'], p=[0.45, 0.5, 0.05])
            location = np.random.choice(['US', 'UK', 'CA', 'AU'], p=[0.7, 0.15, 0.1, 0.05])
            
            # Simulate session data based on review behavior
            session_count = max(1, int(num_reviews * 2 + np.random.poisson(10)))
            avg_session_duration = 180 + engagement_score * 300 + np.random.exponential(120)
            page_views = max(1, int(session_count * 3 + np.random.poisson(15)))
            
            # Purchase behavior from review patterns
            purchase_history = max(0, verified_purchases + np.random.poisson(2))
            total_spent = purchase_history * (50 + engagement_score * 200 + np.random.exponential(100))
            
            # Historical conversion simulation
            historical_conversion_rate = min(0.8, engagement_score * 0.6 + np.random.beta(2, 3) * 0.4)
            
            user_profile = {
                'user_id': f'amz_user_{customer_id}',
                'age': age,
                'gender': gender,
                'location': location,
                'session_count': session_count,
                'avg_session_duration': avg_session_duration,
                'page_views': page_views,
                'purchase_history': purchase_history,
                'total_spent': total_spent,
                'engagement_score': engagement_score,
                'previous_experiments': '',
                'historical_conversion_rate': historical_conversion_rate,
                'created_at': datetime.now().isoformat(),
                'review_count': num_reviews,
                'avg_rating_given': avg_rating if not pd.isna(avg_rating) else 3.5,
                'helpful_votes_received': total_helpful_votes if not pd.isna(total_helpful_votes) else 0,
                'verified_purchase_ratio': verified_ratio
            }
            
            user_profiles.append(user_profile)
            
        except Exception as e:
            logger.warning(f"Error processing customer {customer_id}: {str(e)}")
            continue
    
    df_users = pd.DataFrame(user_profiles)
    
    if len(df_users) < 1000:
        logger.info(f"Only {len(df_users)} users from Amazon data, supplementing with synthetic data")
        synthetic_df = generate_user_bucketing_data(5000 - len(df_users))
        df_users = pd.concat([df_users, synthetic_df], ignore_index=True)
    
    logger.info(f"Created {len(df_users)} user profiles from Amazon reviews data")
    return df_users
