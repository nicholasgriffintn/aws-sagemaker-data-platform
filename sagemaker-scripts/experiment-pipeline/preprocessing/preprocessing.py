#!/usr/bin/env python3

import argparse
import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.base import BaseEstimator, TransformerMixin
import joblib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FeatureEngineeringTransformer(BaseEstimator, TransformerMixin):
    """
    Custom transformer that handles all feature engineering and encoding
    to ensure training/serving consistency
    """
    
    def __init__(self):
        self.label_encoders = {}
        self.scaler = StandardScaler()
        self.feature_columns = None
        self.age_bins = None
        self.spending_bins = None
        
    def fit(self, X, y=None):
        """Fit the transformer on training data"""
        df = X.copy()
        
        df = self._create_engineered_features(df)
        
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
        """Transform new data using fitted parameters"""
        df = X.copy()
        
        df = self._create_engineered_features(df)
        
        df = self._encode_features(df)
        
        X_final = df[self.feature_columns].fillna(0)
        
        X_scaled = self.scaler.transform(X_final)
        
        return pd.DataFrame(X_scaled, columns=self.feature_columns, index=X.index)
    
    def _create_engineered_features(self, df):
        """Create engineered features"""
        # High value user flag (only for training)
        if 'engagement_score' in df.columns and 'total_spent' in df.columns:
            df['high_value_user'] = (
                (df['engagement_score'] > df['engagement_score'].quantile(0.7)) & 
                (df['total_spent'] > df['total_spent'].quantile(0.6))
            ).astype(int)
        
        # Spend per purchase
        df['spend_per_purchase'] = np.where(df['purchase_history'] > 0, 
                                           df['total_spent'] / df['purchase_history'], 0)
        
        # Session efficiency
        df['session_efficiency'] = df['page_views'] / np.maximum(df['session_count'], 1)
        
        # Age groups (fit bins on training data)
        if self.age_bins is None:
            self.age_bins = [0, 25, 35, 50, 100]
        df['age_group'] = pd.cut(df['age'], bins=self.age_bins, 
                                labels=['young', 'adult', 'middle_aged', 'senior'])
        
        # Spending tiers (fit bins on training data)
        if self.spending_bins is None:
            self.spending_bins = [-1, 0, 50, 200, np.inf]
        df['spending_tier'] = pd.cut(df['total_spent'], bins=self.spending_bins,
                                    labels=['none', 'low', 'medium', 'high'])
        
        return df
    
    def _encode_features(self, df):
        """Encode categorical features"""
        categorical_features = ['gender', 'location', 'age_group', 'spending_tier']
        
        for feature in categorical_features:
            if feature in df.columns and feature in self.label_encoders:
                # Handle unseen categories by using the most frequent class
                le = self.label_encoders[feature]
                df[f'{feature}_encoded'] = df[feature].astype(str).apply(
                    lambda x: le.transform([x])[0] if x in le.classes_ else le.transform([le.classes_[0]])[0]
                )
            elif feature in df.columns:
                # If encoder not fitted, fill with 0
                df[f'{feature}_encoded'] = 0
        
        return df

def preprocess_data():
    """
    Preprocess user bucketing data for experiment assignment model training
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
    
    logger.info("Starting feature engineering with unified transformer...")
    
    feature_transformer = FeatureEngineeringTransformer()
    
    df['high_value_user'] = (
        (df['engagement_score'] > df['engagement_score'].quantile(0.7)) & 
        (df['total_spent'] > df['total_spent'].quantile(0.6))
    ).astype(int)
    
    base_features = ['age', 'session_count', 'avg_session_duration', 'page_views',
                    'purchase_history', 'total_spent', 'engagement_score',
                    'historical_conversion_rate', 'gender', 'location']
    
    X_raw = df[base_features]
    y = df['high_value_user']
    
    logger.info(f"Target distribution: {y.value_counts().to_dict()}")
    
    # Split data
    X_raw_temp, X_raw_test, y_temp, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )
    
    X_raw_train, X_raw_val, y_train, y_val = train_test_split(
        X_raw_temp, y_temp, test_size=0.25, random_state=42, stratify=y_temp
    )
    
    logger.info(f"Train set size: {len(X_raw_train)}")
    logger.info(f"Validation set size: {len(X_raw_val)}")
    logger.info(f"Test set size: {len(X_raw_test)}")
    
    # Fit transformer on training data and transform all sets
    feature_transformer.fit(X_raw_train)
    
    X_train_scaled = feature_transformer.transform(X_raw_train)
    X_val_scaled = feature_transformer.transform(X_raw_val)
    X_test_scaled = feature_transformer.transform(X_raw_test)
    
    logger.info(f"Features after transformation: {len(feature_transformer.feature_columns)}")
    
    # Save processed data
    os.makedirs(args.train_data, exist_ok=True)
    os.makedirs(args.validation_data, exist_ok=True)
    os.makedirs(args.test_data, exist_ok=True)
    
    # Save training data
    train_df = X_train_scaled.copy()
    train_df['target'] = y_train.values
    train_df.to_csv(os.path.join(args.train_data, 'train.csv'), index=False)
    
    # Save validation data
    val_df = X_val_scaled.copy()
    val_df['target'] = y_val.values
    val_df.to_csv(os.path.join(args.validation_data, 'validation.csv'), index=False)
    
    # Save test data
    test_df = X_test_scaled.copy()
    test_df['target'] = y_test.values
    test_df.to_csv(os.path.join(args.test_data, 'test.csv'), index=False)
    
    # Save the unified feature transformer
    joblib.dump(feature_transformer, os.path.join(args.train_data, 'feature_transformer.pkl'))
    
    # Also save raw training data for pipeline training
    raw_train_df = X_raw_train.copy()
    raw_train_df['target'] = y_train.values
    raw_train_df.to_csv(os.path.join(args.train_data, 'raw_train.csv'), index=False)
    
    raw_val_df = X_raw_val.copy()
    raw_val_df['target'] = y_val.values
    raw_val_df.to_csv(os.path.join(args.validation_data, 'raw_validation.csv'), index=False)
    
    logger.info("Data preprocessing completed successfully!")

if __name__ == '__main__':
    preprocess_data()
