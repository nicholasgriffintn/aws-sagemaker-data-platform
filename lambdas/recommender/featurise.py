import datetime

SEGMENT_ENCODING = {
    "16_25": 0,
    "26_35": 1,
    "36_45": 2,
    "46_55": 3,
    "56_65": 4,
}

# This is a simplified featurisation function, it assumes that the parsed_goal
# contains keys that map directly to features needed.
def featurise_template(template, parsed_goal):
    start_time = parsed_goal.get("time_focus", 18)

    duration_days = template.get("duration_days", 14)

    now = datetime.datetime.utcnow()

    return {
        "uplift_pct": 0,
        "num_variants": template.get("num_variants", 2),
        "duration_days": duration_days,
        "start_hour_of_day": start_time,
        "start_day_of_week": now.weekday() + 1,
        "start_month": now.month,
        "surface": template["surface"],
        "platform": template["platform"],
        "content_scope": template["content_scope"],
        "experiment_type": template["experiment_type"],
        "segment_encoded": SEGMENT_ENCODING.get(parsed_goal["segment"], 0),
        "is_personalised": int(template.get("is_personalised", False)),
        "is_algorithm_change": int(template.get("is_algorithm_change", False)),
        "is_copy_only": int(template.get("is_copy_only", False)),
        "uses_notifications": int(template.get("uses_notifications", False)),
    }
