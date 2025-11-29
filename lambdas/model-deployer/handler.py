"""
Model Deployer Lambda

Triggered by EventBridge when a model is approved in SageMaker Model Registry.
Updates the SageMaker endpoint with the newly approved model.
"""

import json
import logging
import os
import time
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sagemaker = boto3.client("sagemaker")


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Handle model registry approval events and deploy the approved model.

    Args:
        event: EventBridge event containing model package details
        context: Lambda context

    Returns:
        Response with deployment status
    """
    logger.info(f"Received event: {json.dumps(event)}")

    try:
        detail = event.get("detail", {})
        model_package_arn = detail.get("ModelPackageArn")
        model_package_status = detail.get("ModelApprovalStatus")

        if not model_package_arn:
            logger.error("No ModelPackageArn in event")
            return {"statusCode": 400, "body": "Missing ModelPackageArn"}

        if model_package_status != "Approved":
            logger.info(f"Model status is {model_package_status}, not Approved. Skipping deployment.")
            return {"statusCode": 200, "body": "Model not approved, skipping"}

        endpoint_name = os.environ.get("ENDPOINT_NAME")
        if not endpoint_name:
            model_package_group = detail.get("ModelPackageGroupName", "")
            component_name = os.environ.get("COMPONENT_NAME", "aws-ml-platform")
            environment_name = os.environ.get("ENVIRONMENT_NAME", "dev")
            pipeline_name = model_package_group.replace(f"{component_name}-", "").replace("-model-group", "")
            endpoint_name = f"{component_name}-{environment_name}-{pipeline_name}-endpoint"

        logger.info(f"Deploying model {model_package_arn} to endpoint {endpoint_name}")

        model_package = sagemaker.describe_model_package(ModelPackageName=model_package_arn)
        model_data_url = model_package["InferenceSpecification"]["Containers"][0].get("ModelDataUrl")
        image_uri = model_package["InferenceSpecification"]["Containers"][0]["Image"]

        timestamp = int(time.time())
        model_name = f"{endpoint_name}-model-{timestamp}"
        endpoint_config_name = f"{endpoint_name}-config-{timestamp}"

        try:
            current_endpoint = sagemaker.describe_endpoint(EndpointName=endpoint_name)
            current_config = sagemaker.describe_endpoint_config(
                EndpointConfigName=current_endpoint["EndpointConfigName"]
            )
        except ClientError as e:
            logger.error(f"Failed to get current endpoint config: {e}")
            raise

        execution_role_arn = os.environ["SAGEMAKER_EXECUTION_ROLE_ARN"]
        
        model_params = {
            "ModelName": model_name,
            "ExecutionRoleArn": execution_role_arn,
            "PrimaryContainer": {
                "Image": image_uri,
                "ModelDataUrl": model_data_url,
            },
        }

        vpc_config = current_config.get("ProductionVariants", [{}])[0].get("VpcConfig")
        if vpc_config:
            model_params["VpcConfig"] = vpc_config

        logger.info(f"Creating model: {model_name}")
        sagemaker.create_model(**model_params)

        production_variants = current_config.get("ProductionVariants", [])
        if production_variants:
            for variant in production_variants:
                variant["ModelName"] = model_name

        endpoint_config_params = {
            "EndpointConfigName": endpoint_config_name,
            "ProductionVariants": production_variants or [
                {
                    "VariantName": "primary",
                    "ModelName": model_name,
                    "InitialInstanceCount": 1,
                    "InstanceType": os.environ.get("INSTANCE_TYPE", "ml.m5.large"),
                    "InitialVariantWeight": 1.0,
                }
            ],
        }

        if "KmsKeyId" in current_config:
            endpoint_config_params["KmsKeyId"] = current_config["KmsKeyId"]

        if "DataCaptureConfig" in current_config:
            endpoint_config_params["DataCaptureConfig"] = current_config["DataCaptureConfig"]

        logger.info(f"Creating endpoint config: {endpoint_config_name}")
        sagemaker.create_endpoint_config(**endpoint_config_params)

        logger.info(f"Updating endpoint {endpoint_name} with new config")
        sagemaker.update_endpoint(
            EndpointName=endpoint_name,
            EndpointConfigName=endpoint_config_name,
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Deployment initiated",
                "endpoint_name": endpoint_name,
                "model_name": model_name,
                "endpoint_config_name": endpoint_config_name,
                "model_package_arn": model_package_arn,
            }),
        }

    except ClientError as e:
        logger.error(f"AWS API error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }

