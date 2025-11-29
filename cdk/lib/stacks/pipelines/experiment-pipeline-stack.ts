import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { CfnEndpoint, CfnPipeline } from 'aws-cdk-lib/aws-sagemaker';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { PipelineScriptLocations } from './types';
import { Endpoint } from './constructs/endpoint';
import { SageMakerPipeline } from './constructs/sagemaker-pipeline';
import { getSageMakerImageUri } from '../pipelines/utils/sagemaker';

export interface ExperimentPipelineStackProps extends StackProps {
  environmentName: string;
  componentName: string;
  readonly vpc: Vpc;
  readonly securityGroup: SecurityGroup;
  readonly rawDataBucket: Bucket;
  readonly processedDataBucket: Bucket;
  readonly codeBucket: Bucket;
  readonly dataKey: Key;
  readonly pipelineRole: Role;
  readonly lambdaExecutionRole: Role;
}

/**
 * User Bucketing Pipeline Stack
 *
 * This stack creates the user bucketing ML pipeline including:
 * - SageMaker Pipeline for preprocessing, training, and evaluation
 * - SageMaker Endpoint for real-time inference
 * - Lambda function and API Gateway for user bucketing
 * - Monitoring and alerts
 *
 * Data is generated using the data-generator tool and uploaded to S3.
 */
export class ExperimentPipelineStack extends Stack {
  public readonly pipeline: CfnPipeline;
  public readonly bucketingEndpoint: CfnEndpoint;
  public readonly api: apigw.RestApi;
  public readonly imageId: string;
  public readonly secondaryImageId: string;

  constructor(
    scope: Construct,
    id: string,
    props: ExperimentPipelineStackProps
  ) {
    super(scope, id, props);

    this.imageId = 'ml.m5.large';
    this.secondaryImageId = 'ml.m5.xlarge';

    const sagemakerImageUri = getSageMakerImageUri(this.region);
    const pipelineName = 'bucketing';
    const pipelineNameSuffix = `${pipelineName}-pipeline`;
    const pipelineStackName = `${props.componentName}-${props.environmentName}-${pipelineNameSuffix}`;
    const endpointStackName = `${props.componentName}-${props.environmentName}-bucketing-endpoint`;

    props.codeBucket.grantRead(props.pipelineRole);

    const scriptLocations: PipelineScriptLocations = {
      preprocessing: 'sagemaker-scripts/bucketing-pipeline/preprocess.py',
      training: 'sagemaker-scripts/bucketing-pipeline/train.py',
      evaluation: 'sagemaker-scripts/bucketing-pipeline/evaluate.py',
      inference: 'sagemaker-scripts/bucketing-pipeline/inference.py',
    };

    const pipeline = new SageMakerPipeline(this, 'BucketingTrainingPipeline', {
      componentName: props.componentName,
      environmentName: props.environmentName,
      rawDataBucket: props.rawDataBucket,
      processedDataBucket: props.processedDataBucket,
      codeBucket: props.codeBucket,
      pipelineRole: props.pipelineRole,
      pipelineName,
      vpc: props.vpc,
      securityGroup: props.securityGroup,
      pipelineNameSuffix,
      sagemakerImageUri,
      primaryInstanceType: this.imageId,
      secondaryInstanceType: this.secondaryImageId,
      scriptLocations,
    });

    this.pipeline = pipeline.pipeline;

    const endpoint = new Endpoint(this, 'BucketingEndpoint', {
      componentName: props.componentName,
      environmentName: props.environmentName,
      processedDataBucket: props.processedDataBucket,
      codeBucket: props.codeBucket,
      pipelineRole: props.pipelineRole,
      pipelineName,
      vpc: props.vpc,
      securityGroup: props.securityGroup,
      sagemakerImageUri,
      modelInterfaceScript: 'sagemaker-scripts/bucketing-pipeline/inference.py',
      kmsKeyId: props.dataKey.keyId,
      primaryInstanceType: this.imageId,
      monitoring: {
        pipelineName,
        invocationTargetValue: 100,
      },
    });

    this.bucketingEndpoint = endpoint.resources.endpoint;

    // Lambda function for user bucketing API
    const bucketingLambda = new lambda.Function(this, 'BucketingLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambdas/bucketing'),
      role: props.lambdaExecutionRole,
      environment: {
        ENDPOINT_NAME: endpoint.resources.endpoint.endpointName!,
        FEATURE_SOURCE: 'mock', // Change to 'dynamodb' when ready
      },
    });

    // API Gateway for user bucketing
    this.api = new apigw.RestApi(this, 'BucketingApi', {
      restApiName: `${props.componentName}-${props.environmentName}-User-Bucketing`,
      description: 'API for user bucketing and experiment assignment',
    });

    const bucket = this.api.root.addResource('bucket');
    bucket.addMethod('POST', new apigw.LambdaIntegration(bucketingLambda));

    this.registerOutputs({
      componentName: props.componentName,
      environmentName: props.environmentName,
      pipelineName: pipelineStackName,
      endpointName: endpointStackName,
      apiUrl: this.api.url,
      dataCaptureUri: `s3://${props.processedDataBucket.bucketName}/bucketing-pipeline/data-capture/`,
      alertsTopicArn: endpoint.resources.alertsTopic.topicArn,
    });
  }

  private registerOutputs(params: {
    componentName: string;
    environmentName: string;
    pipelineName: string;
    endpointName: string;
    apiUrl: string;
    dataCaptureUri: string;
    alertsTopicArn: string;
  }) {
    new CfnOutput(this, `${params.componentName}-pipeline-name`, {
      value: params.pipelineName,
      description: 'Name of the user bucketing pipeline',
    });

    new CfnOutput(this, `${params.componentName}-endpoint-name`, {
      value: params.endpointName,
      description: 'Name of the user bucketing inference endpoint',
    });

    new CfnOutput(this, `${params.componentName}-api-url`, {
      value: params.apiUrl,
      description: 'URL of the user bucketing API',
    });

    new CfnOutput(this, `${params.componentName}-alerts-topic-arn`, {
      value: params.alertsTopicArn,
      description: 'ARN of the SNS topic for bucketing pipeline alerts',
    });

    new CfnOutput(this, `${params.componentName}-data-capture-uri`, {
      value: params.dataCaptureUri,
      description: 'S3 URI where endpoint data capture is stored',
    });
  }
}
