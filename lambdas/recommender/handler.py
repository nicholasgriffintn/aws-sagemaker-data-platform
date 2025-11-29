import json
import os

import boto3
import pandas as pd

from goal_parser import parse_goal
from featurise import featurise_template

ENDPOINT_NAME = os.environ.get("ENDPOINT_NAME")

sm = boto3.client("sagemaker-runtime")

def load_templates():
    with open("template_library.json") as f:
        return json.load(f)

# Score candidates based on features via SageMaker endpoint
def score_candidates(candidates):
    df = pd.DataFrame(candidates)

    resp = sm.invoke_endpoint(
        EndpointName=ENDPOINT_NAME,
        ContentType="application/json",
        Body=df.drop(columns=["template_id"]).to_json(orient="records")
    )

    payload = json.loads(resp["Body"].read())
    preds = payload["predictions"]

    for i, pred in enumerate(preds):
        candidates[i]["predicted_uplift"] = pred

    return candidates

# Lambda handler
def handler(event, context):
    body = json.loads(event["body"])
    goal = body.get("goal", "")
    n = body.get("top_n", 5)

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

    return {
        "statusCode": 200,
        "body": json.dumps({
            "goal": goal,
            "parsed": parsed,
            "recommendations": top
        })
    }
