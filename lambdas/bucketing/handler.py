import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))

from sagemaker_client import SageMakerPredictor
from response import api_response, error_response
from user_features import get_user_features

ENDPOINT_NAME = os.environ.get("ENDPOINT_NAME")
predictor = SageMakerPredictor(ENDPOINT_NAME)


def handler(event, context):
    body = json.loads(event.get("body", "{}"))
    user_id = body.get("user_id")

    if not user_id:
        return error_response(400, "user_id is required")

    features = get_user_features(user_id)

    if not features:
        return error_response(404, f"User {user_id} not found")

    prediction = predict_bucket(features)

    return api_response(200, {
        "user_id": user_id,
        "bucket": prediction["predicted_bucket"],
        "confidence": prediction["confidence"],
        "experiment_assignment": prediction["experiment_assignment"],
        "features_used": {
            "engagement_score": features.get("engagement_score"),
            "total_spent": features.get("total_spent"),
        },
    })


def predict_bucket(features: dict) -> dict:
    payload = [{
        "age": features.get("age"),
        "session_count": features.get("session_count"),
        "avg_session_duration": features.get("avg_session_duration"),
        "page_views": features.get("page_views"),
        "purchase_history": features.get("purchase_history"),
        "total_spent": features.get("total_spent"),
        "engagement_score": features.get("engagement_score"),
        "historical_conversion_rate": features.get("historical_conversion_rate"),
        "gender": features.get("gender"),
        "location": features.get("location"),
    }]

    return predictor.predict(payload)
