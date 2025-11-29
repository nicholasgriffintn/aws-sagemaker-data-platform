from typing import Any

USER_FEATURE_NAMES = [
    'age',
    'session_count',
    'avg_session_duration',
    'page_views',
    'purchase_history',
    'total_spent',
    'engagement_score',
    'historical_conversion_rate',
    'gender',
    'location',
]

USER_FEATURE_VALIDATION: dict[str, dict[str, Any]] = {
    'age': {'type': (int, float), 'range': (0, 120)},
    'session_count': {'type': (int, float), 'range': (0, None)},
    'avg_session_duration': {'type': (int, float), 'range': (0, None)},
    'page_views': {'type': (int, float), 'range': (0, None)},
    'purchase_history': {'type': (int, float), 'range': (0, None)},
    'total_spent': {'type': (int, float), 'range': (0, None)},
    'engagement_score': {'type': (int, float), 'range': (0, 1)},
    'historical_conversion_rate': {'type': (int, float), 'range': (0, 1)},
    'gender': {'type': str, 'values': ['male', 'female', 'other', 'M', 'F', 'O']},
    'location': {'type': str, 'range': None},
}

USER_FEATURE_DEFAULTS: dict[str, Any] = {
    'age': 30,
    'session_count': 0,
    'avg_session_duration': 0.0,
    'page_views': 0,
    'purchase_history': 0,
    'total_spent': 0.0,
    'engagement_score': 0.0,
    'historical_conversion_rate': 0.0,
    'gender': 'M',
    'location': 'US',
}

SEGMENT_ENCODING = {
    '16_25': 0,
    '26_35': 1,
    '36_45': 2,
    '46_55': 3,
    '56_65': 4,
}

