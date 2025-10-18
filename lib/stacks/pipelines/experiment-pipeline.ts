import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { CfnEndpoint, CfnPipeline } from 'aws-cdk-lib/aws-sagemaker';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { PipelineScriptLocations } from './types';
import { DataIngestion } from './constructs/data-ingestion';
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
}

export class ExperimentPipelineStack extends Stack {
  public readonly pipeline: CfnPipeline;
  public readonly dataIngestionLambda: LambdaFunction;
  public readonly experimentEndpoint: CfnEndpoint;
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
    const pipelineName = 'experiment';
    const pipelineNameSuffix = `${pipelineName}-bucketing-pipeline`;
    const pipelineStackName = `${props.componentName}-${props.environmentName}-${pipelineNameSuffix}`;
    const endpointStackName = `${props.componentName}-${props.environmentName}-experiment-endpoint`;

    const dataIngestion = new DataIngestion(this, 'ExperimentDataIngestion', {
      componentName: props.componentName,
      environmentName: props.environmentName,
      rawDataBucket: props.rawDataBucket,
      dataKey: props.dataKey,
    });
    this.dataIngestionLambda = dataIngestion.lambda;

    props.codeBucket.grantRead(props.pipelineRole);

    const scriptLocations: PipelineScriptLocations = {
      preprocessing:
        'sagemaker-scripts/experiment-pipeline/preprocessing/preprocessing.py',
      training: 'sagemaker-scripts/experiment-pipeline/training/train.py',
      evaluation:
        'sagemaker-scripts/experiment-pipeline/evaluation/evaluate.py',
      inference: 'sagemaker-scripts/experiment-pipeline/inference/inference.py',
    };

    const pipeline = new SageMakerPipeline(this, 'ExperimentTrainingPipeline', {
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

    const endpoint = new Endpoint(this, 'ExperimentEndpoint', {
      componentName: props.componentName,
      environmentName: props.environmentName,
      processedDataBucket: props.processedDataBucket,
      codeBucket: props.codeBucket,
      pipelineRole: props.pipelineRole,
      pipelineName,
      vpc: props.vpc,
      securityGroup: props.securityGroup,
      sagemakerImageUri,
      kmsKeyId: props.dataKey.keyId,
      primaryInstanceType: this.imageId,
      monitoring: {
        pipelineName,
        invocationTargetValue: 100,
      },
    });

    this.experimentEndpoint = endpoint.resources.endpoint;

    this.registerOutputs({
      componentName: props.componentName,
      environmentName: props.environmentName,
      pipelineName: pipelineStackName,
      endpointName: endpointStackName,
      dataCaptureUri: `s3://${props.processedDataBucket.bucketName}/experiment-pipeline/data-capture/`,
      alertsTopicArn: endpoint.resources.alertsTopic.topicArn,
    });
  }

  private registerOutputs(params: {
    componentName: string;
    environmentName: string;
    pipelineName: string;
    endpointName: string;
    dataCaptureUri: string;
    alertsTopicArn: string;
  }) {
    new CfnOutput(this, `${params.componentName}-pipeline-name`, {
      value: params.pipelineName,
      description: 'Name of the experiment bucketing pipeline',
    });

    new CfnOutput(this, `${params.componentName}-endpoint-name`, {
      value: params.endpointName,
      description: 'Name of the experiment bucketing inference endpoint',
    });

    new CfnOutput(this, `${params.componentName}-alerts-topic-arn`, {
      value: params.alertsTopicArn,
      description: 'ARN of the SNS topic for experiment pipeline alerts',
    });

    new CfnOutput(this, `${params.componentName}-data-capture-uri`, {
      value: params.dataCaptureUri,
      description: 'S3 URI where endpoint data capture is stored',
    });

    new CfnOutput(this, `${params.componentName}-data-ingestion-lambda-name`, {
      value: this.dataIngestionLambda.functionName,
      description: 'Name of the data ingestion Lambda function',
    });
  }
}
