import json
import boto3


class SageMakerPredictor:
    def __init__(self, endpoint_name: str):
        self.client = boto3.client("sagemaker-runtime")
        self.endpoint_name = endpoint_name

    def predict(self, payload: dict | list) -> dict | list:
        response = self.client.invoke_endpoint(
            EndpointName=self.endpoint_name,
            ContentType="application/json",
            Body=json.dumps(payload),
        )
        result = json.loads(response["Body"].read())

        if isinstance(result, list) and len(result) == 1:
            return result[0]
        return result

    def predict_batch(self, payloads: list[dict]) -> list[dict]:
        response = self.client.invoke_endpoint(
            EndpointName=self.endpoint_name,
            ContentType="application/json",
            Body=json.dumps(payloads),
        )
        return json.loads(response["Body"].read())

