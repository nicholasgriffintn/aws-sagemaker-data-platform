#!/usr/bin/env python3
import json
import os
import logging

import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from platform_shared import (
    BaseInferenceHandler,
    USER_FEATURE_NAMES,
    USER_FEATURE_VALIDATION,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REQUIRED_FEATURES = USER_FEATURE_NAMES


class BucketingInferenceHandler(BaseInferenceHandler):
    def __init__(self):
        super().__init__(logger)
        self.feature_transformer = None
        self.is_pipeline = False

    def model_fn(self, model_dir: str):
        model = joblib.load(os.path.join(model_dir, 'model.pkl'))
        logger.info(f"Model loaded successfully: {type(model).__name__}")
        
        self.is_pipeline = isinstance(model, Pipeline)
        self.model = model
        
        if not self.is_pipeline:
            transformer_path = os.path.join(model_dir, 'feature_transformer.pkl')
            if os.path.exists(transformer_path):
                self.feature_transformer = joblib.load(transformer_path)
                logger.info("Feature transformer loaded for standalone model")
            else:
                logger.warning("No feature transformer found - model expects pre-processed features")
        
        return model

    def input_fn(self, request_body: str, request_content_type: str) -> pd.DataFrame:
        if request_content_type != 'application/json':
            raise ValueError(f"Unsupported content type: {request_content_type}")
        
        input_data = json.loads(request_body)
        
        if isinstance(input_data, dict):
            input_data = [input_data]
        
        df = pd.DataFrame(input_data)
        
        missing_features = [f for f in REQUIRED_FEATURES if f not in df.columns]
        if missing_features:
            raise ValueError(f"Missing required features: {missing_features}")
        
        self._validate_input_data(df)
        
        return df[REQUIRED_FEATURES]

    def _validate_input_data(self, df: pd.DataFrame) -> None:
        for col, rules in USER_FEATURE_VALIDATION.items():
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

    def predict_fn(self, input_data: pd.DataFrame, model) -> list[dict]:
        if self.is_pipeline:
            X = input_data
            model_version = 'unified_pipeline'
        elif self.feature_transformer is not None:
            X = self.feature_transformer.transform(input_data)
            model_version = 'transformer_plus_model'
        else:
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
                'experiment_assignment': self._assign_experiment(pred, prob[1]),
                'model_version': model_version
            }
            results.append(result)
        
        return results

    def _assign_experiment(self, prediction: int, high_value_prob: float) -> dict:
        if prediction == 1:
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
        else:
            if high_value_prob > 0.3:
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


_handler = BucketingInferenceHandler()

def model_fn(model_dir):
    return _handler.model_fn(model_dir)

def input_fn(request_body, request_content_type):
    return _handler.input_fn(request_body, request_content_type)

def predict_fn(input_data, model):
    return _handler.predict_fn(input_data, model)

def output_fn(prediction, content_type):
    return _handler.output_fn(prediction, content_type)


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
