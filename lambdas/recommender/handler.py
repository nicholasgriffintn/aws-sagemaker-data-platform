import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))

import pandas as pd

from config import require
from decorators import handle_errors, log_request, parse_json_body, require_fields
from response import api_response, error_response
from sagemaker_client import SageMakerPredictor
from goal_parser import parse_goal
from featurise import featurise_template

predictor = SageMakerPredictor(require('endpoint_name'))

TOP_N_MIN = 1
TOP_N_MAX = 100
TOP_N_DEFAULT = 5


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


@handle_errors
@log_request
@parse_json_body
@require_fields('goal')
def handler(event, context):
    body = event['parsed_body']
    goal = body['goal']
    
    n = body.get("top_n", TOP_N_DEFAULT)
    if not isinstance(n, int) or n < TOP_N_MIN or n > TOP_N_MAX:
        return error_response(400, f"top_n must be an integer between {TOP_N_MIN} and {TOP_N_MAX}")

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
