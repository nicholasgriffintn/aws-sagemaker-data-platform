from platform_shared import (
    require,
    handle_errors,
    log_request,
    parse_json_body,
    require_fields,
    api_response,
    error_response,
    SageMakerPredictor,
    USER_FEATURE_NAMES,
)
from user_features import get_user_features

predictor = SageMakerPredictor(require('endpoint_name'))


@handle_errors
@log_request
@parse_json_body
@require_fields('user_id')
def handler(event, context):
    body = event['parsed_body']
    user_id = body['user_id']

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
    payload = [{k: features.get(k) for k in USER_FEATURE_NAMES}]
    return predictor.predict(payload)
