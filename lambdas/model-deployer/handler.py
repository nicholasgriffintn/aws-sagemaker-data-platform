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
            pipeline_name = model_package_group.replace(f"{component_name}-{environment_name}-", "").replace("-models", "")
            endpoint_name = f"{component_name}-{environment_name}-{pipeline_name}-endpoint"

        logger.info(f"Deploying model {model_package_arn} to endpoint {endpoint_name}")

        model_package = sagemaker.describe_model_package(ModelPackageName=model_package_arn)
        model_data_url = model_package["InferenceSpecification"]["Containers"][0].get("ModelDataUrl")
        image_uri = model_package["InferenceSpecification"]["Containers"][0]["Image"]

        timestamp = int(time.time())
        model_name = f"{endpoint_name}-model-{timestamp}"
        endpoint_config_name = f"{endpoint_name}-config-{timestamp}"

        execution_role_arn = os.environ["SAGEMAKER_EXECUTION_ROLE_ARN"]
        use_serverless = os.environ.get("USE_SERVERLESS", "false").lower() == "true"
        instance_type = os.environ.get("INSTANCE_TYPE", "ml.m5.large")
        kms_key_id = os.environ.get("KMS_KEY_ID", "")
        security_group_id = os.environ.get("SECURITY_GROUP_ID", "")
        subnet_ids_str = os.environ.get("SUBNET_IDS", "")
        subnet_ids = [s.strip() for s in subnet_ids_str.split(",") if s.strip()] if subnet_ids_str else []
        processed_data_bucket = os.environ.get("PROCESSED_DATA_BUCKET", "")
        data_capture_prefix = os.environ.get("DATA_CAPTURE_PREFIX", "")

        # Check if endpoint exists
        endpoint_exists = False
        current_config = None
        try:
            current_endpoint = sagemaker.describe_endpoint(EndpointName=endpoint_name)
            endpoint_exists = True
            current_config = sagemaker.describe_endpoint_config(
                EndpointConfigName=current_endpoint["EndpointConfigName"]
            )
            logger.info(f"Endpoint {endpoint_name} exists, will update it")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ValidationException":
                logger.info(f"Endpoint {endpoint_name} does not exist, will create it")
                endpoint_exists = False
            else:
                logger.error(f"Failed to check endpoint: {e}")
                raise

        # Build VPC config if needed (not for serverless endpoints)
        vpc_config = None
        if not use_serverless and security_group_id and subnet_ids:
            vpc_config = {
                "SecurityGroupIds": [security_group_id],
                "Subnets": subnet_ids,
            }

        # Create model
        model_params = {
            "ModelName": model_name,
            "ExecutionRoleArn": execution_role_arn,
            "PrimaryContainer": {
                "Image": image_uri,
                "ModelDataUrl": model_data_url,
            },
        }
        if vpc_config:
            model_params["VpcConfig"] = vpc_config

        logger.info(f"Creating model: {model_name}")
        sagemaker.create_model(**model_params)

        # Build production variants
        if use_serverless:
            production_variants = [
                {
                    "VariantName": "primary",
                    "ModelName": model_name,
                    "ServerlessConfig": {
                        "MemorySizeInMB": int(os.environ.get("SERVERLESS_MEMORY_SIZE_MB", "2048")),
                        "MaxConcurrency": int(os.environ.get("SERVERLESS_MAX_CONCURRENCY", "5")),
                    },
                }
            ]
        else:
            production_variants = [
                {
                    "VariantName": "primary",
                    "ModelName": model_name,
                    "InitialInstanceCount": 1,
                    "InstanceType": instance_type,
                    "InitialVariantWeight": 1.0,
                }
            ]

        # Build endpoint config
        endpoint_config_params = {
            "EndpointConfigName": endpoint_config_name,
            "ProductionVariants": production_variants,
        }

        if kms_key_id:
            endpoint_config_params["KmsKeyId"] = kms_key_id

        # Add data capture config for non-serverless endpoints
        if not use_serverless and processed_data_bucket and data_capture_prefix:
            endpoint_config_params["DataCaptureConfig"] = {
                "EnableCapture": True,
                "InitialSamplingPercentage": 100,
                "DestinationS3Uri": f"s3://{processed_data_bucket}/{data_capture_prefix}",
                "KmsKeyId": kms_key_id,
                "CaptureOptions": [
                    {"CaptureMode": "Input"},
                    {"CaptureMode": "Output"},
                ],
                "CaptureContentTypeHeader": {
                    "JsonContentTypes": ["application/json"],
                    "CsvContentTypes": ["text/csv"],
                },
            }

        logger.info(f"Creating endpoint config: {endpoint_config_name}")
        sagemaker.create_endpoint_config(**endpoint_config_params)

        # Create or update endpoint
        if endpoint_exists:
            logger.info(f"Updating endpoint {endpoint_name} with new config")
            sagemaker.update_endpoint(
                EndpointName=endpoint_name,
                EndpointConfigName=endpoint_config_name,
            )
        else:
            logger.info(f"Creating endpoint {endpoint_name} with new config")
            sagemaker.create_endpoint(
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

