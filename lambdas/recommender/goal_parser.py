import re
import os
import sys
import json
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))

from config import get

logger = logging.getLogger(__name__)

USE_BEDROCK = get('use_bedrock', False)
BEDROCK_MODEL_ID = get('bedrock_model_id', 'anthropic.claude-3-haiku-20240307-v1:0')


def parse_goal(goal: str) -> dict:
    if USE_BEDROCK:
        try:
            return parse_goal_with_bedrock(goal)
        except Exception as e:
            logger.warning(f"Bedrock parsing failed, falling back to regex: {e}")
            return parse_goal_regex(goal)
    
    return parse_goal_regex(goal)


def parse_goal_regex(goal: str) -> dict:
    goal_lower = goal.lower()

    result = {
        "segment": None,
        "metric": None,
        "time_focus": None,
    }

    if "16" in goal_lower and "25" in goal_lower:
        result["segment"] = "16_25"
    elif "25" in goal_lower and "35" in goal_lower:
        result["segment"] = "26_35"
    elif "36" in goal_lower and "45" in goal_lower:
        result["segment"] = "36_45"
    elif "46" in goal_lower and "55" in goal_lower:
        result["segment"] = "46_55"
    elif "56" in goal_lower and "65" in goal_lower:
        result["segment"] = "56_65"
    elif "young" in goal_lower or "youth" in goal_lower:
        result["segment"] = "16_25"
    elif "senior" in goal_lower or "older" in goal_lower:
        result["segment"] = "56_65"

    time_match = re.search(r"(?:at\s+)?(\d{1,2})(?::00)?(?:\s*(?:pm|am))?", goal_lower)
    if time_match:
        hour = int(time_match.group(1))
        if "pm" in goal_lower and hour < 12:
            hour += 12
        result["time_focus"] = hour

    if "live news" in goal_lower:
        hour = result.get("time_focus", 18)
        result["metric"] = f"live_news_{hour}_consumption"
    elif "live sport" in goal_lower:
        result["metric"] = "live_sport_consumption"
    elif "engagement" in goal_lower:
        result["metric"] = "engagement_score"
    elif "consumption" in goal_lower:
        result["metric"] = "content_consumption"
    elif "retention" in goal_lower:
        result["metric"] = "user_retention"
    elif "click" in goal_lower:
        result["metric"] = "click_through_rate"
    elif "conversion" in goal_lower:
        result["metric"] = "conversion_rate"

    return result


def parse_goal_with_bedrock(goal: str) -> dict:
    import boto3
    
    bedrock = boto3.client('bedrock-runtime')
    
    prompt = f"""Parse this business goal into structured experiment parameters.

Goal: "{goal}"

Return ONLY valid JSON with these fields:
- segment: age group in format like "16_25", "26_35", "36_45", "46_55", "56_65" or null
- metric: the primary metric to optimize (e.g., "live_news_18_consumption", "engagement_score", "click_through_rate") or null
- time_focus: hour of day (0-23) if a specific time is mentioned, or null

Examples:
- "increase live news at 18:00 for 16-25s" -> {{"segment": "16_25", "metric": "live_news_18_consumption", "time_focus": 18}}
- "boost engagement for older users" -> {{"segment": "56_65", "metric": "engagement_score", "time_focus": null}}

Respond with only the JSON, no explanation."""

    response = bedrock.invoke_model(
        modelId=BEDROCK_MODEL_ID,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 200,
            "temperature": 0.1,
        })
    )
    
    response_body = json.loads(response['body'].read())
    content = response_body['content'][0]['text']
    
    try:
        parsed = json.loads(content)
        return {
            "segment": parsed.get("segment"),
            "metric": parsed.get("metric"),
            "time_focus": parsed.get("time_focus"),
        }
    except json.JSONDecodeError:
        json_match = re.search(r'\{[^}]+\}', content)
        if json_match:
            parsed = json.loads(json_match.group())
            return {
                "segment": parsed.get("segment"),
                "metric": parsed.get("metric"),
                "time_focus": parsed.get("time_focus"),
            }
        raise ValueError(f"Could not parse Bedrock response as JSON: {content}")
