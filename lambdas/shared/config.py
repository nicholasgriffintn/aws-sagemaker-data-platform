import os
from functools import lru_cache
from typing import Any


@lru_cache
def get_config() -> dict[str, Any]:
    return {
        'endpoint_name': os.environ.get('ENDPOINT_NAME'),
        'feature_source': os.environ.get('FEATURE_SOURCE', 'mock'),
        'dynamodb_table': os.environ.get('DYNAMODB_TABLE', 'user-features'),
        'feature_group_name': os.environ.get('FEATURE_GROUP_NAME', 'user-bucketing-features'),
        'region': os.environ.get('AWS_REGION', 'eu-west-1'),
        'use_bedrock': os.environ.get('USE_BEDROCK_PARSER', 'false').lower() == 'true',
        'bedrock_model_id': os.environ.get(
            'BEDROCK_MODEL_ID', 
            'anthropic.claude-3-haiku-20240307-v1:0'
        ),
        'cors_origin': os.environ.get('CORS_ORIGIN', '*'),
        'log_level': os.environ.get('LOG_LEVEL', 'INFO'),
    }


def get(key: str, default: Any = None) -> Any:
    config = get_config()
    return config.get(key, default)


def require(key: str) -> Any:
    value = get(key)
    if value is None:
        raise ValueError(f"Required configuration '{key}' is not set")
    return value

