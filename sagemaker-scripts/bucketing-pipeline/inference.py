#!/usr/bin/env python3
"""
Inference script for user bucketing pipeline.

Handles real-time inference requests for user bucketing predictions.
Supports both Pipeline models (with preprocessing) and standalone classifiers.
"""

import json
import joblib
import pandas as pd
import numpy as np
import os
import logging
from sklearn.pipeline import Pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REQUIRED_FEATURES = [
    'age', 'session_count', 'avg_session_duration', 'page_views',
    'purchase_history', 'total_spent', 'engagement_score',
    'historical_conversion_rate', 'gender', 'location'
]

# Global model and transformer references
MODEL = None
FEATURE_TRANSFORMER = None
IS_PIPELINE = False


def model_fn(model_dir):
    """Load model for inference."""
    global MODEL, FEATURE_TRANSFORMER, IS_PIPELINE
    
    try:
        model = joblib.load(os.path.join(model_dir, 'model.pkl'))
        logger.info(f"Model loaded successfully: {type(model).__name__}")
        
        # Check if it's a Pipeline (includes preprocessing)
        IS_PIPELINE = isinstance(model, Pipeline)
        MODEL = model
        
        if not IS_PIPELINE:
            # Try to load the feature transformer separately
            transformer_path = os.path.join(model_dir, 'feature_transformer.pkl')
            if os.path.exists(transformer_path):
                FEATURE_TRANSFORMER = joblib.load(transformer_path)
                logger.info("Feature transformer loaded for standalone model")
            else:
                logger.warning("No feature transformer found - model expects pre-processed features")
                FEATURE_TRANSFORMER = None
        
        return model
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        raise


def input_fn(request_body, request_content_type):
    """Parse and validate input data for inference."""
    if request_content_type != 'application/json':
        raise ValueError(f"Unsupported content type: {request_content_type}")
    
    input_data = json.loads(request_body)
    
    if isinstance(input_data, dict):
        input_data = [input_data]
    
    df = pd.DataFrame(input_data)
    
    missing_features = [f for f in REQUIRED_FEATURES if f not in df.columns]
    if missing_features:
        raise ValueError(f"Missing required features: {missing_features}")
    
    _validate_input_data(df)
    
    return df[REQUIRED_FEATURES]


def _validate_input_data(df):
    """Validate input data types and ranges."""
    validations = {
        'age': {'type': (int, float), 'range': (0, 120)},
        'session_count': {'type': (int, float), 'range': (0, None)},
        'avg_session_duration': {'type': (int, float), 'range': (0, None)},
        'page_views': {'type': (int, float), 'range': (0, None)},
        'purchase_history': {'type': (int, float), 'range': (0, None)},
        'total_spent': {'type': (int, float), 'range': (0, None)},
        'engagement_score': {'type': (int, float), 'range': (0, 1)},
        'historical_conversion_rate': {'type': (int, float), 'range': (0, 1)},
        'gender': {'type': str, 'values': ['male', 'female', 'other', 'M', 'F', 'O']},
        'location': {'type': str, 'range': None}
    }
    
    for col, rules in validations.items():
        if col not in df.columns:
            continue
            
        if not df[col].apply(lambda x: isinstance(x, rules['type'])).all():
            raise ValueError(f"Invalid data type for {col}. Expected {rules['type']}")
        
        if 'range' in rules and rules['range'] is not None:
            min_val, max_val = rules['range']
            if min_val is not None and (df[col] < min_val).any():
                raise ValueError(f"Values in {col} below minimum {min_val}")
            if max_val is not None and (df[col] > max_val).any():
                raise ValueError(f"Values in {col} above maximum {max_val}")
        
        if 'values' in rules and rules['values'] is not None:
            invalid_values = df[col][~df[col].isin(rules['values'])].unique()
            if len(invalid_values) > 0:
                logger.warning(f"Unknown values in {col}: {invalid_values}")


def predict_fn(input_data, model):
    """Make predictions using the model."""
    global FEATURE_TRANSFORMER, IS_PIPELINE
    
    try:
        # Prepare data based on model type
        if IS_PIPELINE:
            # Pipeline includes preprocessing, use raw data
            X = input_data
            model_version = 'unified_pipeline'
        elif FEATURE_TRANSFORMER is not None:
            # Apply feature transformer before prediction
            X = FEATURE_TRANSFORMER.transform(input_data)
            model_version = 'transformer_plus_model'
        else:
            # Assume data is already processed
            X = input_data
            model_version = 'standalone_model'
        
        predictions = model.predict(X)
        probabilities = model.predict_proba(X)
        
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            result = {
                'user_index': i,
                'predicted_bucket': 'high_value' if pred == 1 else 'standard',
                'confidence': float(prob[pred]),
                'high_value_probability': float(prob[1]),
                'standard_probability': float(prob[0]),
                'experiment_assignment': _assign_experiment(pred, prob[1]),
                'model_version': model_version
            }
            results.append(result)
        
        return results
        
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}")
        raise


def _assign_experiment(prediction, high_value_prob):
    """Assign users to experiments based on bucketing prediction."""
    if prediction == 1:  # High value user
        if high_value_prob > 0.8:
            return {
                'experiment_type': 'premium_features',
                'variant': 'A' if np.random.random() > 0.5 else 'B',
                'priority': 'high'
            }
        else:
            return {
                'experiment_type': 'engagement_boost',
                'variant': 'A' if np.random.random() > 0.5 else 'B',
                'priority': 'medium'
            }
    else:  # Standard user
        if high_value_prob > 0.3:  # Potential high-value user
            return {
                'experiment_type': 'conversion_optimization',
                'variant': 'A' if np.random.random() > 0.5 else 'B',
                'priority': 'medium'
            }
        else:
            return {
                'experiment_type': 'basic_features',
                'variant': 'A' if np.random.random() > 0.5 else 'B',
                'priority': 'low'
            }


def output_fn(prediction, content_type):
    """Format output."""
    if content_type == 'application/json':
        return json.dumps(prediction)
    raise ValueError(f"Unsupported content type: {content_type}")


if __name__ == '__main__':
    sample_input = {
        'age': 35,
        'session_count': 20,
        'avg_session_duration': 450.0,
        'page_views': 35,
        'purchase_history': 5,
        'total_spent': 250.0,
        'engagement_score': 0.75,
        'historical_conversion_rate': 0.4,
        'gender': 'female',
        'location': 'US'
    }
    print("Sample input (raw features):", json.dumps(sample_input, indent=2))

