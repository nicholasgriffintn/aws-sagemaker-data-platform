import json
import os
import boto3

from user_features import get_user_features

ENDPOINT_NAME = os.environ.get("ENDPOINT_NAME")

sm = boto3.client("sagemaker-runtime")


def handler(event, context):
    """
    Bucket a user for experiment assignment.
    
    Takes a user_id, fetches their features, and returns their bucket
    assignment along with experiment recommendations.
    """
    body = json.loads(event.get("body", "{}"))
    user_id = body.get("user_id")
    
    if not user_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "user_id is required"})
        }
    
    # Fetch user features (from database, cache, or feature store)
    features = get_user_features(user_id)
    
    if not features:
        return {
            "statusCode": 404,
            "body": json.dumps({"error": f"User {user_id} not found"})
        }
    
    # Call SageMaker endpoint for prediction
    prediction = predict_bucket(features)
    
    return {
        "statusCode": 200,
        "body": json.dumps({
            "user_id": user_id,
            "bucket": prediction["predicted_bucket"],
            "confidence": prediction["confidence"],
            "experiment_assignment": prediction["experiment_assignment"],
            "features_used": {
                "engagement_score": features.get("engagement_score"),
                "total_spent": features.get("total_spent"),
            }
        })
    }


def predict_bucket(features: dict) -> dict:
    """Call SageMaker endpoint to get bucket prediction."""
    # Format features for the endpoint
    payload = json.dumps([{
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
    }])
    
    response = sm.invoke_endpoint(
        EndpointName=ENDPOINT_NAME,
        ContentType="application/json",
        Body=payload
    )
    
    result = json.loads(response["Body"].read())
    
    # Handle both single and batch responses
    if isinstance(result, list):
        return result[0]
    return result

