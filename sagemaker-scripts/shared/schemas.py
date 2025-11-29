from typing import Any

# ============================================================================
# User Bucketing Features
# ============================================================================

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

ENGINEERED_FEATURE_NAMES = [
    'age',
    'session_count',
    'avg_session_duration',
    'page_views',
    'purchase_history',
    'total_spent',
    'engagement_score',
    'historical_conversion_rate',
    'spend_per_purchase',
    'session_efficiency',
    'gender_encoded',
    'location_encoded',
    'age_group_encoded',
    'spending_tier_encoded',
]

# Feature validation rules for input data
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

# Default values for missing features
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

# ============================================================================
# Bucketing Configuration
# ============================================================================

AGE_BINS = [0, 25, 35, 50, 100]
AGE_LABELS = ['young', 'adult', 'middle_aged', 'senior']

SPENDING_BINS = [-1, 0, 50, 200, float('inf')]
SPENDING_LABELS = ['none', 'low', 'medium', 'high']

# High-value user thresholds (quantiles)
HIGH_VALUE_ENGAGEMENT_QUANTILE = 0.7
HIGH_VALUE_SPENDING_QUANTILE = 0.6

# ============================================================================
# Recommender Features
# ============================================================================

SEGMENT_ENCODING = {
    '16_25': 0,
    '26_35': 1,
    '36_45': 2,
    '46_55': 3,
    '56_65': 4,
}

RECOMMENDER_FEATURE_NAMES = [
    'num_variants',
    'duration_days',
    'start_hour_of_day',
    'start_day_of_week',
    'start_month',
    'surface',
    'platform',
    'content_scope',
    'experiment_type',
    'segment_encoded',
    'is_personalised',
    'is_algorithm_change',
    'is_copy_only',
    'uses_notifications',
]

# ============================================================================
# Model Evaluation Thresholds
# ============================================================================

BUCKETING_THRESHOLDS = {
    'accuracy': ('min', 0.75),
    'precision': ('min', 0.70),
    'recall': ('min', 0.65),
    'auc': ('min', 0.80),
}

RECOMMENDER_THRESHOLDS = {
    'rmse': ('max', 5.0),
    'mae': ('max', 3.0),
    'r2': ('min', 0.6),
}

