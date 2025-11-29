"""
User Features Module

Fetches user features for bucketing predictions.
Currently uses mock data - extend to connect to your feature store,
database, or cache (e.g., DynamoDB, Redis, SageMaker Feature Store).
"""

import boto3
import os
from typing import Optional

# TODO: Configure your feature source
FEATURE_SOURCE = os.environ.get("FEATURE_SOURCE", "mock")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "user-features")


def get_user_features(user_id: str) -> Optional[dict]:
    """
    Fetch user features by user_id.
    
    Extend this function to integrate with your data sources:
    - DynamoDB for real-time features
    - SageMaker Feature Store for ML features
    - Redis/ElastiCache for cached features
    - API call to your user service
    """
    if FEATURE_SOURCE == "dynamodb":
        return _get_from_dynamodb(user_id)
    elif FEATURE_SOURCE == "mock":
        return _get_mock_features(user_id)
    else:
        return _get_mock_features(user_id)


def _get_from_dynamodb(user_id: str) -> Optional[dict]:
    """Fetch features from DynamoDB."""
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(DYNAMODB_TABLE)
    
    response = table.get_item(Key={"user_id": user_id})
    
    if "Item" not in response:
        return None
    
    item = response["Item"]
    return {
        "user_id": item.get("user_id"),
        "age": int(item.get("age", 30)),
        "gender": item.get("gender", "M"),
        "location": item.get("location", "US"),
        "session_count": int(item.get("session_count", 0)),
        "avg_session_duration": float(item.get("avg_session_duration", 0)),
        "page_views": int(item.get("page_views", 0)),
        "purchase_history": int(item.get("purchase_history", 0)),
        "total_spent": float(item.get("total_spent", 0)),
        "engagement_score": float(item.get("engagement_score", 0)),
        "historical_conversion_rate": float(item.get("historical_conversion_rate", 0)),
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

