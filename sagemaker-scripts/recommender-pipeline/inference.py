import json
import logging

import joblib
import pandas as pd
import xgboost as xgb

from platform_shared import BaseInferenceHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RecommenderInferenceHandler(BaseInferenceHandler):
    def __init__(self):
        super().__init__(logger)
        self.features = None

    def model_fn(self, model_dir: str):
        self.model = xgb.Booster()
        self.model.load_model(f"{model_dir}/model.bst")
        self.features = joblib.load(f"{model_dir}/feature_list.pkl")
        return self.model

    def input_fn(self, request_body: str, request_content_type: str) -> pd.DataFrame:
        if request_content_type != "application/json":
            raise ValueError(f"Unsupported content type: {request_content_type}")
        data = json.loads(request_body)
        return pd.DataFrame(data, columns=self.features)

    def predict_fn(self, input_data: pd.DataFrame, model) -> list:
        d = xgb.DMatrix(input_data)
        preds = model.predict(d)
        return preds.tolist()

    def output_fn(self, prediction, content_type: str) -> str:
        return json.dumps({"predictions": prediction})


_handler = RecommenderInferenceHandler()

def model_fn(model_dir):
    return _handler.model_fn(model_dir)

def input_fn(request_body, request_content_type):
    return _handler.input_fn(request_body, request_content_type)

def predict_fn(input_data, model):
    return _handler.predict_fn(input_data, model)

def output_fn(prediction, response_content_type):
    return _handler.output_fn(prediction, response_content_type)
