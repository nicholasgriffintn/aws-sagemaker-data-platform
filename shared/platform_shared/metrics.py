import logging
from typing import Any, Dict, Optional

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    mean_squared_error,
    mean_absolute_error,
    r2_score,
)


class MetricsTracker:
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)
        self.metrics: Dict[str, float] = {}

    def compute_classification_metrics(
        self,
        y_true: Any,
        y_pred: Any,
        y_pred_proba: Optional[Any] = None
    ) -> Dict[str, float]:
        self.metrics = {
            'accuracy': float(accuracy_score(y_true, y_pred)),
            'precision': float(precision_score(y_true, y_pred, zero_division=0)),
            'recall': float(recall_score(y_true, y_pred, zero_division=0)),
            'f1_score': float(f1_score(y_true, y_pred, zero_division=0)),
        }

        if y_pred_proba is not None:
            try:
                self.metrics['auc'] = float(roc_auc_score(y_true, y_pred_proba))
            except ValueError:
                self.metrics['auc'] = 0.0

        self._log_metrics()
        return self.metrics

    def compute_regression_metrics(
        self,
        y_true: Any,
        y_pred: Any
    ) -> Dict[str, float]:
        self.metrics = {
            'mse': float(mean_squared_error(y_true, y_pred)),
            'rmse': float(mean_squared_error(y_true, y_pred, squared=False)),
            'mae': float(mean_absolute_error(y_true, y_pred)),
            'r2': float(r2_score(y_true, y_pred)),
        }

        self._log_metrics()
        return self.metrics

    def _log_metrics(self) -> None:
        self.logger.info(f"Metrics: {self.metrics}")

    def get_metrics(self) -> Dict[str, float]:
        return self.metrics

