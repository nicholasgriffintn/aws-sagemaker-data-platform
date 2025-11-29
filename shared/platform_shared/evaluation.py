import json
import logging
import os
from typing import Any, Literal

import joblib

from .metrics import MetricsTracker


class ModelEvaluator:
    def __init__(
        self,
        logger: logging.Logger | None = None,
        model_type: Literal['classification', 'regression'] = 'classification'
    ):
        self.logger = logger or logging.getLogger(__name__)
        self.model_type = model_type
        self._metrics_tracker = MetricsTracker(self.logger)

    @property
    def metrics(self) -> dict[str, float]:
        return self._metrics_tracker.get_metrics()

    def load_model(self, model_path: str, extension: str = '.pkl') -> Any:
        model_file = os.path.join(model_path, f'model{extension}')
        
        if not os.path.exists(model_file):
            model_files = [
                f for f in os.listdir(model_path) 
                if f.endswith(extension) and 'model' in f
            ]
            if model_files:
                model_file = os.path.join(model_path, model_files[0])
            else:
                raise FileNotFoundError(f"No model file found in {model_path}")
        
        if extension == '.bst':
            import xgboost as xgb
            model = xgb.Booster()
            model.load_model(model_file)
        else:
            model = joblib.load(model_file)
        
        self.logger.info(f"Loaded model from {model_file}")
        return model

    def compute_metrics(
        self,
        y_true: Any,
        y_pred: Any,
        y_pred_proba: Any | None = None
    ) -> dict[str, float]:
        if self.model_type == 'classification':
            return self._metrics_tracker.compute_classification_metrics(
                y_true, y_pred, y_pred_proba
            )
        return self._metrics_tracker.compute_regression_metrics(y_true, y_pred)

    def check_approval(self, thresholds: dict[str, tuple[str, float]]) -> dict:
        approval_criteria = {}
        
        for metric_name, (operator, threshold) in thresholds.items():
            if metric_name not in self.metrics:
                continue
            
            value = self.metrics[metric_name]
            if operator == 'min':
                approval_criteria[f'{metric_name}_pass'] = value >= threshold
            else:
                approval_criteria[f'{metric_name}_pass'] = value <= threshold

        all_criteria_met = all(approval_criteria.values())
        
        return {
            'approve_model': all_criteria_met,
            'approval_criteria': approval_criteria,
            'thresholds': {k: v[1] for k, v in thresholds.items()},
            'recommendation_reason': 'All criteria met' if all_criteria_met else 'Some criteria not met'
        }

    def save_results(
        self,
        output_path: str,
        evaluation_metrics: dict,
        approval_recommendation: dict
    ) -> None:
        os.makedirs(output_path, exist_ok=True)
        
        with open(os.path.join(output_path, 'evaluation_metrics.json'), 'w') as f:
            json.dump(evaluation_metrics, f, indent=2)
        
        with open(os.path.join(output_path, 'model_approval.json'), 'w') as f:
            json.dump(approval_recommendation, f, indent=2)
        
        status = 'APPROVE' if approval_recommendation['approve_model'] else 'REJECT'
        self.logger.info(f"Model approval recommendation: {status}")

