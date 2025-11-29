import json
import logging
import functools
from typing import Any, Callable

from .response import api_response, error_response

logger = logging.getLogger(__name__)


def handle_errors(func: Callable) -> Callable:
    @functools.wraps(func)
    def wrapper(event: dict, context: Any) -> dict:
        try:
            return func(event, context)
        except json.JSONDecodeError:
            logger.warning("Invalid JSON in request body")
            return error_response(400, "Invalid JSON in request body")
        except ValueError as e:
            logger.warning(f"Validation error: {e}")
            return error_response(400, str(e))
        except KeyError as e:
            logger.warning(f"Missing required field: {e}")
            return error_response(400, f"Missing required field: {e}")
        except Exception as e:
            logger.exception("Unexpected error in handler")
            return error_response(500, f"Internal server error: {str(e)}")
    
    return wrapper


def log_request(func: Callable) -> Callable:
    @functools.wraps(func)
    def wrapper(event: dict, context: Any) -> dict:
        request_id = getattr(context, 'aws_request_id', 'unknown')
        
        logger.info(f"Request {request_id}: {event.get('httpMethod', 'N/A')} {event.get('path', 'N/A')}")
        
        response = func(event, context)
        
        status_code = response.get('statusCode', 'unknown')
        logger.info(f"Response {request_id}: {status_code}")
        
        return response
    
    return wrapper


def parse_json_body(func: Callable) -> Callable:
    @functools.wraps(func)
    def wrapper(event: dict, context: Any) -> dict:
        body_str = event.get('body', '{}')
        if body_str is None:
            body_str = '{}'
        
        event['parsed_body'] = json.loads(body_str)
        return func(event, context)
    
    return wrapper


def require_fields(*required: str) -> Callable:
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(event: dict, context: Any) -> dict:
            body = event.get('parsed_body', {})
            
            missing = [field for field in required if field not in body or body[field] is None]
            if missing:
                return error_response(400, f"Missing required fields: {', '.join(missing)}")
            
            return func(event, context)
        
        return wrapper
    return decorator

