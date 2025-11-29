import os
import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

import joblib


@dataclass
class TrainingConfig:
    model_dir: str = os.environ.get('SM_MODEL_DIR', '/opt/ml/model')
    train_path: str = os.environ.get('SM_CHANNEL_TRAINING', '/opt/ml/input/data/training')
    validation_path: str = os.environ.get('SM_CHANNEL_VALIDATION', '/opt/ml/input/data/validation')


def setup_logging(name: str = __name__) -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(name)


def save_model_artifacts(
    model_dir: str,
    model: Any,
    metrics: dict,
    metadata: Optional[dict] = None,
    model_filename: str = 'model.pkl'
) -> None:
    os.makedirs(model_dir, exist_ok=True)

    model_path = os.path.join(model_dir, model_filename)

    if model_filename.endswith('.pkl'):
        joblib.dump(model, model_path)
    elif model_filename.endswith('.bst'):
        model.save_model(model_path)
    else:
        joblib.dump(model, model_path)

    with open(os.path.join(model_dir, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)

    if metadata:
        with open(os.path.join(model_dir, 'metadata.json'), 'w') as f:
            json.dump(metadata, f, indent=2)

