import json
import xgboost as xgb
import pandas as pd
import joblib

MODEL = None
FEATURES = None

def model_fn(model_dir):
    global MODEL, FEATURES
    MODEL = xgb.Booster()
    MODEL.load_model(f"{model_dir}/model.bst")
    FEATURES = joblib.load(f"{model_dir}/feature_list.pkl")
    return MODEL

def input_fn(request_body, request_content_type):
    if request_content_type == "application/json":
        data = json.loads(request_body)
        return pd.DataFrame(data, columns=FEATURES)
    raise ValueError(f"Unsupported content type: {request_content_type}")

def predict_fn(input_data, model):
    d = xgb.DMatrix(input_data)
    preds = model.predict(d)
    return preds.tolist()

def output_fn(prediction, response_content_type):
    return json.dumps({"predictions": prediction})
