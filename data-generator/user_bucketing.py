"""
User Bucketing Data Generator

Generates synthetic user data for experiment bucketing and A/B testing.
"""

import numpy as np
import pandas as pd
from datetime import datetime
from faker import Faker
import random

fake = Faker()

GENDERS = ['M', 'F', 'Other']
GENDER_WEIGHTS = [0.48, 0.48, 0.04]

LOCATIONS = ['US', 'UK', 'CA', 'AU', 'DE', 'FR']
LOCATION_WEIGHTS = [0.4, 0.15, 0.1, 0.1, 0.15, 0.1]


def generate_user_bucketing_data(num_users: int = 10_000) -> pd.DataFrame:
    """
    Generate synthetic user data that mimics real-world patterns
    for A/B testing and experiment bucketing scenarios.
    
    Features generated:
    - Demographics: age, gender, location
    - Behavior: session_count, avg_session_duration, page_views
    - Value: purchase_history, total_spent, engagement_score
    - Historical experiment assignments: previous_experiments, historical_conversion_rate
    
    Args:
        num_users: Number of user records to generate
        
    Returns:
        DataFrame with user bucketing features
    """
    print(f"Generating {num_users:,} user bucketing records...")
    
    # User demographics
    user_ids = [f'user_{i:06d}' for i in range(num_users)]
    ages = np.random.normal(35, 12, num_users).astype(int)
    ages = np.clip(ages, 18, 80)
    
    genders = np.random.choice(GENDERS, num_users, p=GENDER_WEIGHTS)
    locations = np.random.choice(LOCATIONS, num_users, p=LOCATION_WEIGHTS)
    
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
    
    print(f"Generated dataset with {len(df):,} records and {len(df.columns)} features")
    return df


def generate_high_value_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add high_value_user labels to user data for training.
    
    High value users are identified based on engagement score and spending patterns.
    
    Args:
        df: User bucketing DataFrame
        
    Returns:
        DataFrame with high_value_user label added
    """
    df = df.copy()
    df['high_value_user'] = (
        (df['engagement_score'] > df['engagement_score'].quantile(0.7)) & 
        (df['total_spent'] > df['total_spent'].quantile(0.6))
    ).astype(int)
    return df


def main():
    """Generate user bucketing data and save to output directory."""
    import os
    
    out_path = "output/raw/user_bucketing"
    os.makedirs(out_path, exist_ok=True)
    
    print("Generating user bucketing data...")
    df = generate_user_bucketing_data(10_000)
    df = generate_high_value_labels(df)
    
    output_file = f"{out_path}/user_bucketing_data.csv"
    df.to_csv(output_file, index=False)
    print(f"Saved to {output_file}")
    
    print("DONE.")


if __name__ == "__main__":
    main()

