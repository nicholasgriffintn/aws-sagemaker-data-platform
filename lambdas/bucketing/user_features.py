import os
import boto3
import logging
from typing import Optional

from platform_shared import get, USER_FEATURE_DEFAULTS

logger = logging.getLogger(__name__)

FEATURE_SOURCE = get('feature_source', 'mock')
DYNAMODB_TABLE = get('dynamodb_table', 'user-features')
FEATURE_GROUP_NAME = get('feature_group_name', 'user-bucketing-features')
AWS_REGION = os.environ.get('AWS_REGION', 'eu-west-1')


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
    defaults = USER_FEATURE_DEFAULTS
    return {
        "user_id": str(raw_features.get("user_id", "")),
        "age": int(float(raw_features.get("age", defaults['age']))),
        "gender": str(raw_features.get("gender", defaults['gender'])),
        "location": str(raw_features.get("location", defaults['location'])),
        "session_count": int(float(raw_features.get("session_count", defaults['session_count']))),
        "avg_session_duration": float(raw_features.get("avg_session_duration", defaults['avg_session_duration'])),
        "page_views": int(float(raw_features.get("page_views", defaults['page_views']))),
        "purchase_history": int(float(raw_features.get("purchase_history", defaults['purchase_history']))),
        "total_spent": float(raw_features.get("total_spent", defaults['total_spent'])),
        "engagement_score": float(raw_features.get("engagement_score", defaults['engagement_score'])),
        "historical_conversion_rate": float(raw_features.get("historical_conversion_rate", defaults['historical_conversion_rate'])),
    }


def _get_mock_features(user_id: str) -> Optional[dict]:
    user_hash = hash(user_id) % 100
    
    if user_hash < 20:
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
