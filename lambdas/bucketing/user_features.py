"""
User Features Module

Fetches user features for bucketing predictions.
Supports multiple data sources:
- mock: Synthetic data for development/testing
- dynamodb: Real-time features from DynamoDB
- feature_store: SageMaker Feature Store for ML features
"""

import boto3
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Configuration
FEATURE_SOURCE = os.environ.get("FEATURE_SOURCE", "mock")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "user-features")
FEATURE_GROUP_NAME = os.environ.get("FEATURE_GROUP_NAME", "user-bucketing-features")
AWS_REGION = os.environ.get("AWS_REGION", "eu-west-1")


def get_user_features(user_id: str) -> Optional[dict]:
    """
    Fetch user features by user_id.
    
    Supports multiple data sources configured via FEATURE_SOURCE env var:
    - "mock": Synthetic data for development
    - "dynamodb": Real-time features from DynamoDB
    - "feature_store": SageMaker Feature Store for ML features
    
    Args:
        user_id: Unique identifier for the user
        
    Returns:
        dict of user features or None if not found
    """
    if FEATURE_SOURCE == "dynamodb":
        return _get_from_dynamodb(user_id)
    elif FEATURE_SOURCE == "feature_store":
        return _get_from_feature_store(user_id)
    else:
        return _get_mock_features(user_id)


def _get_from_dynamodb(user_id: str) -> Optional[dict]:
    """Fetch features from DynamoDB."""
    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(DYNAMODB_TABLE)
        
        response = table.get_item(Key={"user_id": user_id})
        
        if "Item" not in response:
            logger.warning(f"User {user_id} not found in DynamoDB")
            return None
        
        item = response["Item"]
        return _normalize_features(item)
    except Exception as e:
        logger.error(f"Error fetching from DynamoDB: {e}")
        return None


def _get_from_feature_store(user_id: str) -> Optional[dict]:
    """
    Fetch features from SageMaker Feature Store.
    
    Requires the feature group to have been created with the appropriate schema.
    See: https://docs.aws.amazon.com/sagemaker/latest/dg/feature-store.html
    """
    try:
        featurestore_runtime = boto3.client(
            'sagemaker-featurestore-runtime',
            region_name=AWS_REGION
        )
        
        response = featurestore_runtime.get_record(
            FeatureGroupName=FEATURE_GROUP_NAME,
            RecordIdentifierValueAsString=user_id
        )
        
        if "Record" not in response:
            logger.warning(f"User {user_id} not found in Feature Store")
            return None
        
        # Convert Feature Store response to dict
        features = {}
        for feature in response["Record"]:
            feature_name = feature["FeatureName"]
            value = feature["ValueAsString"]
            features[feature_name] = value
        
        return _normalize_features(features)
    except featurestore_runtime.exceptions.ResourceNotFoundException:
        logger.warning(f"Feature group {FEATURE_GROUP_NAME} not found")
        return None
    except Exception as e:
        logger.error(f"Error fetching from Feature Store: {e}")
        return None


def _normalize_features(raw_features: dict) -> dict:
    """Normalize features to expected types."""
    return {
        "user_id": str(raw_features.get("user_id", "")),
        "age": int(float(raw_features.get("age", 30))),
        "gender": str(raw_features.get("gender", "M")),
        "location": str(raw_features.get("location", "US")),
        "session_count": int(float(raw_features.get("session_count", 0))),
        "avg_session_duration": float(raw_features.get("avg_session_duration", 0)),
        "page_views": int(float(raw_features.get("page_views", 0))),
        "purchase_history": int(float(raw_features.get("purchase_history", 0))),
        "total_spent": float(raw_features.get("total_spent", 0)),
        "engagement_score": float(raw_features.get("engagement_score", 0)),
        "historical_conversion_rate": float(raw_features.get("historical_conversion_rate", 0)),
    }


def _get_mock_features(user_id: str) -> Optional[dict]:
    """
    Return mock features for development/testing.
    
    In production, replace this with real feature fetching.
    """
    # Simulate different user profiles based on user_id hash
    user_hash = hash(user_id) % 100
    
    if user_hash < 20:
        # High-value user profile
        return {
            "user_id": user_id,
            "age": 35,
            "gender": "F",
            "location": "US",
            "session_count": 45,
            "avg_session_duration": 720.0,
            "page_views": 120,
            "purchase_history": 12,
            "total_spent": 850.0,
            "engagement_score": 0.85,
            "historical_conversion_rate": 0.45,
        }
    elif user_hash < 50:
        # Medium-value user profile
        return {
            "user_id": user_id,
            "age": 28,
            "gender": "M",
            "location": "UK",
            "session_count": 20,
            "avg_session_duration": 360.0,
            "page_views": 45,
            "purchase_history": 3,
            "total_spent": 150.0,
            "engagement_score": 0.55,
            "historical_conversion_rate": 0.25,
        }
    else:
        # Standard user profile
        return {
            "user_id": user_id,
            "age": 42,
            "gender": "M",
            "location": "CA",
            "session_count": 8,
            "avg_session_duration": 180.0,
            "page_views": 15,
            "purchase_history": 1,
            "total_spent": 25.0,
            "engagement_score": 0.25,
            "historical_conversion_rate": 0.1,
        }

