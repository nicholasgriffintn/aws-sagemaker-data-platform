import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))

import pandas as pd

from sagemaker_client import SageMakerPredictor
from response import api_response, error_response
from goal_parser import parse_goal
from featurise import featurise_template

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

ENDPOINT_NAME = os.environ.get("ENDPOINT_NAME")
predictor = SageMakerPredictor(ENDPOINT_NAME)


def load_templates():
    with open(os.path.join(os.path.dirname(__file__), "template_library.json")) as f:
        return json.load(f)


def score_candidates(candidates):
    df = pd.DataFrame(candidates)

    payload = df.drop(columns=["template_id"]).to_json(orient="records")
    result = predictor.predict(json.loads(payload))

    preds = result["predictions"] if isinstance(result, dict) else result

    for i, pred in enumerate(preds):
        candidates[i]["predicted_uplift"] = pred

    return candidates


def handler(event, context):
    try:
        body_str = event.get("body", "{}")
        if not body_str:
            return error_response(400, "Request body is required")
        
        try:
            body = json.loads(body_str)
        except json.JSONDecodeError:
            return error_response(400, "Invalid JSON in request body")
        
        goal = body.get("goal", "")
        if not goal:
            return error_response(400, "goal is required")
        
        n = body.get("top_n", 5)
        if not isinstance(n, int) or n < 1 or n > 100:
            return error_response(400, "top_n must be an integer between 1 and 100")

        parsed = parse_goal(goal)
        templates = load_templates()

        candidates = []
        for t in templates:
            feats = featurise_template(t, parsed)
            feats["template_id"] = t["id"]
            feats["description"] = t["description"]
            candidates.append(feats)

        scored = score_candidates(candidates)
        scored_sorted = sorted(scored, key=lambda x: x["predicted_uplift"], reverse=True)
        top = scored_sorted[:n]

        return api_response(200, {
            "goal": goal,
            "parsed": parsed,
            "recommendations": top,
        })
    
    except Exception as e:
        logger.exception("Unexpected error in recommender handler")
        return error_response(500, f"Internal server error: {str(e)}")
