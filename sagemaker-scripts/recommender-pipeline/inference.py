import json
import logging

import joblib
import pandas as pd
import xgboost as xgb

from platform_shared import BaseInferenceHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RecommenderInferenceHandler(BaseInferenceHandler):
    """
    Handler for the recommender inference pipeline.
    
    Implements SageMaker's inference pattern for XGBoost regression model.
    Predicts uplift percentages for experiment recommendations.
    
    The handler:
    - Loads XGBoost Booster model (.bst format)
    - Validates input features match training feature list
    - Generates continuous uplift predictions (regression)
    - Returns predictions as JSON
    """
    def __init__(self):
        """
        Initializes the recommender inference handler.
        """
        super().__init__(logger)
        self.features = None

    def model_fn(self, model_dir: str):
        """
        Loads the XGBoost model and feature list from the model directory.
        
        XGBoost models are saved in .bst format (binary format optimized for fast loading).
        The feature list ensures input features match the training feature order.

        Args:
            model_dir: The path to the model directory.

        Returns:
            The loaded XGBoost Booster model.
        """
        # XGBoost Booster: The trained ensemble of decision trees
        # Contains all trees built during training, ready for fast inference
        # Learn more: https://xgboost.readthedocs.io/en/stable/python/python_api.html#xgboost.Booster
        self.model = xgb.Booster()
        self.model.load_model(f"{model_dir}/model.bst")
        
        # Load feature list to ensure input features match training order
        # XGBoost requires features in the same order as during training
        self.features = joblib.load(f"{model_dir}/feature_list.pkl")
        return self.model

    def input_fn(self, request_body: str, request_content_type: str) -> pd.DataFrame:
        """
        Parses JSON request and creates DataFrame with features in correct order.
        
        XGBoost requires features in the exact same order as during training.
        The feature list ensures proper column ordering.

        Args:
            request_body: JSON string with experiment feature data.
            request_content_type: Expected to be 'application/json'.

        Returns:
            DataFrame with features in training order, ready for XGBoost prediction.
        """
        if request_content_type != "application/json":
            raise ValueError(f"Unsupported content type: {request_content_type}")
        data = json.loads(request_body)
        # Ensure features are in the same order as training
        # XGBoost is sensitive to feature order (unlike tree-based sklearn models)
        return pd.DataFrame(data, columns=self.features)

    def predict_fn(self, input_data: pd.DataFrame, model) -> list:
        """
        Generates uplift predictions using the XGBoost model.
        
        XGBoost prediction process:
        1. Convert DataFrame to DMatrix (optimized internal format)
        2. For each sample, sum predictions from all trees in the ensemble
        3. Returns continuous values (uplift percentages)
        
        The prediction is the sum of all tree outputs, where each tree
        contributes a small correction to the final uplift estimate.

        Args:
            input_data: DataFrame with experiment features (in training order).
            model: The loaded XGBoost Booster model.

        Returns:
            List of uplift percentage predictions (continuous values).
            Positive values = expected positive impact, negative = expected negative impact.
        """
        # DMatrix: XGBoost's optimized data structure for fast inference
        # Learn more: https://xgboost.readthedocs.io/en/stable/python/python_api.html#xgboost.DMatrix
        d = xgb.DMatrix(input_data)
        
        # Predict: Sum of predictions from all trees in the ensemble
        # Each tree outputs a value, final prediction = sum of all tree outputs
        # Returns numpy array of continuous values (regression)
        # Learn more: https://xgboost.readthedocs.io/en/stable/python/python_api.html#xgboost.Booster.predict
        preds = model.predict(d)
        return preds.tolist()

    def output_fn(self, prediction, content_type: str) -> str:
        """
        Outputs the predictions in the required format.

        Args:
            prediction: The predictions.
            content_type: The content type of the request.

        Returns:
            The predictions in the required format.
        """
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
