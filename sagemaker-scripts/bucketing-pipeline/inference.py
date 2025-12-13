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
    """
    Handler for the bucketing inference pipeline.
    
    Implements SageMaker's inference pattern with four functions:
    - model_fn: Loads the trained model and feature transformer
    - input_fn: Validates and parses incoming JSON requests
    - predict_fn: Applies feature transformation and generates predictions
    - output_fn: Formats predictions as JSON response
    
    The handler supports three model configurations:
    1. Unified Pipeline: sklearn Pipeline with built-in preprocessing
    2. Transformer + Model: Separate transformer and model files
    3. Standalone Model: Pre-processed features only (no transformation)
    """
    def __init__(self):
        """
        Initializes the bucketing inference handler.
        """
        super().__init__(logger)
        self.feature_transformer = None
        self.is_pipeline = False

    def model_fn(self, model_dir: str):
        """
        Loads the model from the model directory.
        
        This function is called once when the SageMaker endpoint starts.
        It loads either:
        - A sklearn Pipeline (contains both preprocessing and model)
        - A standalone model + separate feature transformer
        - A standalone model expecting pre-processed features

        Args:
            model_dir: The path to the model directory.

        Returns:
            The loaded model (RandomForestClassifier or LogisticRegression).
        """
        model = joblib.load(os.path.join(model_dir, 'model.pkl'))
        logger.info(f"Model loaded successfully: {type(model).__name__}")
        
        # Check if model is a sklearn Pipeline (preprocessing + model combined)
        # Pipeline models handle feature transformation internally
        # Learn more: https://scikit-learn.org/stable/modules/generated/sklearn.pipeline.Pipeline.html
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
        """
        Parses and validates incoming JSON request data.
        
        Expects raw user features (age, engagement, spending, etc.) that will be
        transformed by the feature transformer before prediction.

        Args:
            request_body: The JSON request body (string).
            request_content_type: Expected to be 'application/json'.

        Returns:
            A DataFrame containing the validated input features.
        """
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
        """
        Validates the input data against the user feature validation rules.

        Args:
            df: The DataFrame containing the input data.

        Returns:
            None
        """
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
        """
        Generates predictions for user bucketing.
        
        Applies feature transformation (if needed) then runs inference:
        - For RandomForest: Majority vote across all trees
        - For LogisticRegression: Class with probability > 0.5
        
        Returns both class predictions and probability estimates for confidence scoring.

        Args:
            input_data: Raw user features DataFrame.
            model: The loaded model (RandomForestClassifier or LogisticRegression).

        Returns:
            List of prediction dictionaries with bucket, confidence, and experiment assignment.
        """
        # Apply feature transformation based on model configuration
        if self.is_pipeline:
            # Pipeline handles transformation internally via transform() method
            X = input_data
            model_version = 'unified_pipeline'
        elif self.feature_transformer is not None:
            # Apply the same transformation used during training:
            # - Feature engineering (spend_per_purchase, session_efficiency)
            # - Categorical encoding (gender, location, etc.)
            # - StandardScaler normalization
            X = self.feature_transformer.transform(input_data)
            model_version = 'transformer_plus_model'
        else:
            # Model expects already-transformed features
            X = input_data
            model_version = 'standalone_model'
        
        # Generate predictions: returns 0 (standard) or 1 (high_value)
        # For RandomForest: Majority vote across all trees
        # For LogisticRegression: Class with probability > 0.5
        predictions = model.predict(X)
        
        # Get probability estimates for both classes: [P(class=0), P(class=1)]
        # Useful for confidence scoring and threshold tuning
        # For RandomForest: Average probabilities across all trees
        # For LogisticRegression: Direct output from sigmoid function
        probabilities = model.predict_proba(X)
        
        # Build response with predictions and metadata
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            result = {
                'user_index': i,
                'predicted_bucket': 'high_value' if pred == 1 else 'standard',
                # Confidence: Probability of the predicted class
                # High confidence (>0.8) = model is very certain
                # Low confidence (<0.6) = model is uncertain, may need human review
                'confidence': float(prob[pred]),
                # Probability of being high-value user (regardless of prediction)
                # Useful for threshold tuning: could use 0.7 instead of 0.5 for stricter classification
                'high_value_probability': float(prob[1]),
                'standard_probability': float(prob[0]),
                # Business logic: Assign experiments based on prediction and confidence
                # High confidence high-value users get premium features
                # Low confidence users get engagement boost experiments
                'experiment_assignment': self._assign_experiment(pred, prob[1]),
                'model_version': model_version
            }
            results.append(result)
        
        return results

    def _assign_experiment(self, prediction: int, high_value_prob: float) -> dict:
        """
        Assigns experiments based on model predictions and confidence levels.
        
        This business logic uses both the predicted class and probability to determine
        appropriate experiments. Higher confidence predictions get more targeted treatments.
        
        Experiment assignment strategy:
        - High confidence high-value users (>0.8): Premium features (high priority)
        - Low confidence high-value users (0.5-0.8): Engagement boost (medium priority)
        - Standard users with some high-value signal (>0.3): Conversion optimization
        - Standard users with low signal (<0.3): Basic features (low priority)

        Args:
            prediction: Predicted class (0=standard, 1=high_value).
            high_value_prob: Probability of being high-value user (0-1).

        Returns:
            Dictionary with experiment type, A/B variant, and priority level.
        """
        if prediction == 1:  # Predicted as high-value
            if high_value_prob > 0.8:
                # Very confident high-value user: Give premium treatment
                return {
                    'experiment_type': 'premium_features',
                    'variant': 'A' if np.random.random() > 0.5 else 'B',
                    'priority': 'high'
                }
            else:
                # Uncertain high-value user: Try to boost engagement
                return {
                    'experiment_type': 'engagement_boost',
                    'variant': 'A' if np.random.random() > 0.5 else 'B',
                    'priority': 'medium'
                }
        else:  # Predicted as standard
            if high_value_prob > 0.3:
                # Some high-value signal: Try conversion optimization
                return {
                    'experiment_type': 'conversion_optimization',
                    'variant': 'A' if np.random.random() > 0.5 else 'B',
                    'priority': 'medium'
                }
            else:
                # Low signal: Basic features only
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
