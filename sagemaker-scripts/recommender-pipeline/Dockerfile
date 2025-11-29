FROM python:3.10-slim

RUN pip install --no-cache-dir xgboost pandas pyarrow joblib numpy scikit-learn

COPY inference.py /opt/ml/model/code/inference.py

ENV SAGEMAKER_PROGRAM inference.py
