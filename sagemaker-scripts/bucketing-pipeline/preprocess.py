#!/usr/bin/env python3
import argparse
import os

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.base import BaseEstimator, TransformerMixin
import joblib

from platform_shared import (
    setup_logging,
    AGE_BINS,
    AGE_LABELS,
    SPENDING_BINS,
    SPENDING_LABELS,
    HIGH_VALUE_ENGAGEMENT_QUANTILE,
    HIGH_VALUE_SPENDING_QUANTILE,
)

logger = setup_logging(__name__)


class FeatureEngineeringTransformer(BaseEstimator, TransformerMixin):
    """
    Feature engineering transformer for the bucketing pipeline.
    
    Key transformations:
    - Engineered features: spend_per_purchase, session_efficiency
    - Age bucketing: young, adult, middle_aged, senior
    - Spending tiers: none, low, medium, high
    - Label encoding for categorical variables
    - StandardScaler normalization
    """
    
    def __init__(self):
        """
        Initializes the feature engineering transformer.
        """
        self.label_encoders = {}
        # StandardScaler: Normalizes features to have mean=0 and std=1
        # Formula: (x - mean) / std
        # This is important for algorithms like LogisticRegression that are sensitive to feature scale
        # RandomForest is scale-invariant, but scaling can still help with feature importance interpretation
        # Learn more: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html
        self.scaler = StandardScaler()
        self.feature_columns = None
        self.age_bins = AGE_BINS
        self.spending_bins = SPENDING_BINS
        
    def fit(self, X, y=None):
        """
        Fits the transformer on training data.

        Args:
            X: The training data.
            y: The target data.

        Returns:
            The fitted transformer.
        """
        df = X.copy()
        
        df = self._create_engineered_features(df)
        
        # LabelEncoder: Converts categorical strings to integers (0, 1, 2, ...)
        # Each unique category gets a unique integer label
        # Note: This assumes no ordinal relationship (e.g., 'US'=0, 'UK'=1 doesn't mean US < UK)
        # For tree-based models (RandomForest), this is fine as they can handle arbitrary splits
        # For linear models (LogisticRegression), consider OneHotEncoder for better interpretability
        # Learn more: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.LabelEncoder.html
        # Alternative: OneHotEncoder for linear models - https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.OneHotEncoder.html
        categorical_features = ['gender', 'location', 'age_group', 'spending_tier']
        for feature in categorical_features:
            if feature in df.columns:
                le = LabelEncoder()
                le.fit(df[feature].astype(str))
                self.label_encoders[feature] = le
        
        self.feature_columns = [
            'age', 'session_count', 'avg_session_duration', 'page_views',
            'purchase_history', 'total_spent', 'engagement_score',
            'historical_conversion_rate', 'spend_per_purchase', 'session_efficiency',
            'gender_encoded', 'location_encoded', 'age_group_encoded', 'spending_tier_encoded'
        ]
        
        X_encoded = self._encode_features(df)
        X_final = X_encoded[self.feature_columns].fillna(0)
        
        self.scaler.fit(X_final)
        
        return self
    
    def transform(self, X):
        """
        Transforms the input data using the fitted transformer.

        Args:
            X: The input data.

        Returns:
            A DataFrame containing the transformed data.
        """
        df = X.copy()
        
        df = self._create_engineered_features(df)
        df = self._encode_features(df)
        
        X_final = df[self.feature_columns].fillna(0)
        X_scaled = self.scaler.transform(X_final)
        
        return pd.DataFrame(X_scaled, columns=self.feature_columns, index=X.index)
    
    def _create_engineered_features(self, df):
        """
        Creates engineered features for the input data.
        
        Feature engineering creates new features from existing ones to help the model
        learn better patterns. These domain-specific features often improve model performance
        more than using raw features alone.

        Args:
            df: The input data.

        Returns:
            A DataFrame containing the engineered features.
        """
        # spend_per_purchase: Average amount spent per purchase
        # Captures customer value per transaction, useful for identifying high-value users
        # Handles division by zero for users with no purchases
        df['spend_per_purchase'] = np.where(
            df['purchase_history'] > 0, 
            df['total_spent'] / df['purchase_history'], 
            0
        )
        
        # session_efficiency: Average page views per session
        # Measures engagement intensity - high values indicate engaged users
        # np.maximum prevents division by zero
        df['session_efficiency'] = df['page_views'] / np.maximum(df['session_count'], 1)
        
        # Age bucketing: Converts continuous age into categorical groups
        # Helps models learn non-linear age patterns (e.g., different behaviors by age group)
        # Tree-based models can learn this from raw age, but bucketing can be more interpretable
        df['age_group'] = pd.cut(
            df['age'], 
            bins=self.age_bins, 
            labels=AGE_LABELS
        )
        
        # Spending tier bucketing: Groups users by spending level
        # Creates interpretable segments (none, low, medium, high)
        # Can help with business rule integration and explainability
        df['spending_tier'] = pd.cut(
            df['total_spent'], 
            bins=self.spending_bins,
            labels=SPENDING_LABELS
        )
        
        return df
    
    def _encode_features(self, df):
        """
        Encodes categorical features.

        Args:
            df: The input data.

        Returns:
            A DataFrame containing the encoded features.
        """
        categorical_features = ['gender', 'location', 'age_group', 'spending_tier']
        
        for feature in categorical_features:
            if feature in df.columns and feature in self.label_encoders:
                le = self.label_encoders[feature]
                df[f'{feature}_encoded'] = df[feature].astype(str).apply(
                    lambda x: le.transform([x])[0] if x in le.classes_ else le.transform([le.classes_[0]])[0]
                )
            elif feature in df.columns:
                df[f'{feature}_encoded'] = 0
        
        return df


def main():
    """
    Preprocess the data for the bucketing pipeline.

    Args:
        None

    Returns:
        None
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-data', type=str, default='/opt/ml/processing/input')
    parser.add_argument('--train-data', type=str, default='/opt/ml/processing/train')
    parser.add_argument('--validation-data', type=str, default='/opt/ml/processing/validation')
    parser.add_argument('--test-data', type=str, default='/opt/ml/processing/test')
    
    args = parser.parse_args()
    
    logger.info("Starting data preprocessing...")
    
    input_files = [f for f in os.listdir(args.input_data) if f.endswith('.csv')]
    if not input_files:
        raise ValueError("No CSV files found in input directory")
    
    input_file = sorted(input_files)[-1]
    df = pd.read_csv(os.path.join(args.input_data, input_file))
    
    logger.info(f"Loaded data with shape: {df.shape}")
    
    df['high_value_user'] = (
        (df['engagement_score'] > df['engagement_score'].quantile(HIGH_VALUE_ENGAGEMENT_QUANTILE)) & 
        (df['total_spent'] > df['total_spent'].quantile(HIGH_VALUE_SPENDING_QUANTILE))
    ).astype(int)
    
    base_features = [
        'age', 'session_count', 'avg_session_duration', 'page_views',
        'purchase_history', 'total_spent', 'engagement_score',
        'historical_conversion_rate', 'gender', 'location'
    ]
    
    X_raw = df[base_features]
    y = df['high_value_user']
    
    logger.info(f"Target distribution: {y.value_counts().to_dict()}")
    
    X_raw_temp, X_raw_test, y_temp, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )
    X_raw_train, X_raw_val, y_train, y_val = train_test_split(
        X_raw_temp, y_temp, test_size=0.25, random_state=42, stratify=y_temp
    )
    
    logger.info(f"Train set size: {len(X_raw_train)}")
    logger.info(f"Validation set size: {len(X_raw_val)}")
    logger.info(f"Test set size: {len(X_raw_test)}")
    
    feature_transformer = FeatureEngineeringTransformer()
    feature_transformer.fit(X_raw_train)
    
    X_train_scaled = feature_transformer.transform(X_raw_train)
    X_val_scaled = feature_transformer.transform(X_raw_val)
    X_test_scaled = feature_transformer.transform(X_raw_test)
    
    logger.info(f"Features after transformation: {len(feature_transformer.feature_columns)}")
    
    os.makedirs(args.train_data, exist_ok=True)
    os.makedirs(args.validation_data, exist_ok=True)
    os.makedirs(args.test_data, exist_ok=True)
    
    train_df = X_train_scaled.copy()
    train_df['target'] = y_train.values
    train_df.to_csv(os.path.join(args.train_data, 'train.csv'), index=False)
    
    val_df = X_val_scaled.copy()
    val_df['target'] = y_val.values
    val_df.to_csv(os.path.join(args.validation_data, 'validation.csv'), index=False)
    
    test_df = X_test_scaled.copy()
    test_df['target'] = y_test.values
    test_df.to_csv(os.path.join(args.test_data, 'test.csv'), index=False)
    
    joblib.dump(feature_transformer, os.path.join(args.train_data, 'feature_transformer.pkl'))
    
    raw_train_df = X_raw_train.copy()
    raw_train_df['target'] = y_train.values
    raw_train_df.to_csv(os.path.join(args.train_data, 'raw_train.csv'), index=False)
    
    raw_val_df = X_raw_val.copy()
    raw_val_df['target'] = y_val.values
    raw_val_df.to_csv(os.path.join(args.validation_data, 'raw_validation.csv'), index=False)
    
    logger.info("PREPROCESS COMPLETE")


if __name__ == '__main__':
    main()
