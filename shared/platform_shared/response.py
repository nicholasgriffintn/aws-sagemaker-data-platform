import json
from typing import Any, Dict


def api_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def error_response(status_code: int, message: str) -> Dict[str, Any]:
    return api_response(status_code, {"error": message})

