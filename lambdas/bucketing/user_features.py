import boto3
import os
import sys
import logging
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))

from config import get

logger = logging.getLogger(__name__)

FEATURE_SOURCE = get('feature_source', 'mock')
DYNAMODB_TABLE = get('dynamodb_table', 'user-features')
FEATURE_GROUP_NAME = get('feature_group_name', 'user-bucketing-features')
AWS_REGION = get('region', 'eu-west-1')


def get_user_features(user_id: str) -> Optional[dict]:
    if FEATURE_SOURCE == "dynamodb":
        return _get_from_dynamodb(user_id)
    elif FEATURE_SOURCE == "feature_store":
        return _get_from_feature_store(user_id)
    else:
        return _get_mock_features(user_id)


def _get_from_dynamodb(user_id: str) -> Optional[dict]:
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

