import re

# This will parse the goal given as a demonstration for what we might do but kinda faking it.
# Really, we would want to use Bedrock with AI to do this dynamically.
def parse_goal(goal: str):
    goal = goal.lower()

    result = {
        "segment": None,
        "metric": None,
        "time_focus": None,
    }

    if "16" in goal and "25" in goal:
        result["segment"] = "16_25"
    elif "25" in goal and "35" in goal:
        result["segment"] = "26_35"
    elif "young" in goal:
        result["segment"] = "16_25"

    match = re.search(r"live news.*?(\d{1,2})(?::?00)?", goal)
    if match:
        hour = int(match.group(1))
        result["metric"] = "live_news_18_consumption"
        result["time_focus"] = hour

    if "consumption" in goal and result["metric"] is None:
        result["metric"] = "engagement_score"

    return result
