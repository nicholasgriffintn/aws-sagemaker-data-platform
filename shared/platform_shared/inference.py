import json
import logging
from typing import Any, Optional

import pandas as pd


class BaseInferenceHandler:

    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)
        self.model: Any = None

    def model_fn(self, model_dir: str) -> Any:
        raise NotImplementedError

    def input_fn(self, request_body: str, request_content_type: str) -> pd.DataFrame:
        if request_content_type != 'application/json':
            raise ValueError(f"Unsupported content type: {request_content_type}")
        
        data = json.loads(request_body)
        if isinstance(data, dict):
            data = [data]
        
        return pd.DataFrame(data)

    def predict_fn(self, input_data: pd.DataFrame, model: Any) -> Any:
        raise NotImplementedError

    def output_fn(self, prediction: Any, content_type: str) -> str:
        if content_type != 'application/json':
            raise ValueError(f"Unsupported content type: {content_type}")
        return json.dumps(prediction)

