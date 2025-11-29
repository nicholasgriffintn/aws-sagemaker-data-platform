import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
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

export interface RecommenderPipelineStackProps extends StackProps {
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
 * ML Recommender Pipeline Stack
 *
 * This stack creates the ML experiment recommender pipeline including:
 * - SageMaker Pipeline for preprocessing, training, and evaluation
 * - SageMaker Endpoint for real-time inference
 * - Lambda function and API Gateway for serving recommendations
 * - Monitoring and alerts
 *
 * Data is generated using the data-generator tool and uploaded to S3.
 */
export class RecommenderPipelineStack extends Stack {
  public readonly pipeline: CfnPipeline;
  public readonly recommenderEndpoint: CfnEndpoint;
  public readonly api: apigw.RestApi;
  public readonly imageId: string;
  public readonly secondaryImageId: string;

  constructor(
    scope: Construct,
    id: string,
    props: RecommenderPipelineStackProps
  ) {
    super(scope, id, props);

    this.imageId = 'ml.m5.large';
    this.secondaryImageId = 'ml.m5.xlarge';

    const sagemakerImageUri = getSageMakerImageUri(this.region);
    const pipelineName = 'recommender';
    const pipelineNameSuffix = `${pipelineName}-pipeline`;
    const pipelineStackName = `${props.componentName}-${props.environmentName}-${pipelineNameSuffix}`;
    const endpointStackName = `${props.componentName}-${props.environmentName}-recommender-endpoint`;

    props.codeBucket.grantRead(props.pipelineRole);

    const scriptLocations: PipelineScriptLocations = {
      preprocessing: 'sagemaker-scripts/recommender-pipeline/preprocess.py',
      training: 'sagemaker-scripts/recommender-pipeline/train.py',
      evaluation: 'sagemaker-scripts/recommender-pipeline/evaluate.py',
      inference: 'sagemaker-scripts/recommender-pipeline/inference.py',
    };

    const pipeline = new SageMakerPipeline(
      this,
      'RecommenderTrainingPipeline',
      {
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
      }
    );

    this.pipeline = pipeline.pipeline;

    const endpoint = new Endpoint(this, 'RecommenderEndpoint', {
      componentName: props.componentName,
      environmentName: props.environmentName,
      processedDataBucket: props.processedDataBucket,
      codeBucket: props.codeBucket,
      pipelineRole: props.pipelineRole,
      pipelineName,
      vpc: props.vpc,
      securityGroup: props.securityGroup,
      sagemakerImageUri,
      modelInterfaceScript:
        'sagemaker-scripts/recommender-pipeline/inference.py',
      kmsKeyId: props.dataKey.keyId,
      primaryInstanceType: this.imageId,
      monitoring: {
        pipelineName,
        invocationTargetValue: 100,
      },
    });

    this.recommenderEndpoint = endpoint.resources.endpoint;

    // Lambda function for serving recommendations via API
    const recommenderLambda = new lambda.Function(this, 'RecommenderLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambdas/recommender', {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
        },
      }),
      role: props.lambdaExecutionRole,
      timeout: Duration.seconds(30),
      memorySize: 512,
      environment: {
        ENDPOINT_NAME: endpoint.resources.endpoint.endpointName!,
        USE_BEDROCK_PARSER: 'false',
        BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
      },
    });

    // API Gateway for exposing the recommender
    this.api = new apigw.RestApi(this, 'RecommenderApi', {
      restApiName: `${props.componentName}-${props.environmentName}-ML-Recommender`,
      description: 'API for ML experiment recommendations',
    });

    const recommend = this.api.root.addResource('recommend');
    recommend.addMethod('POST', new apigw.LambdaIntegration(recommenderLambda));

    this.registerOutputs({
      componentName: props.componentName,
      environmentName: props.environmentName,
      pipelineName: pipelineStackName,
      endpointName: endpointStackName,
      apiUrl: this.api.url,
      dataCaptureUri: `s3://${props.processedDataBucket.bucketName}/recommender-pipeline/data-capture/`,
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
      description: 'Name of the recommender pipeline',
    });

    new CfnOutput(this, `${params.componentName}-endpoint-name`, {
      value: params.endpointName,
      description: 'Name of the recommender inference endpoint',
    });

    new CfnOutput(this, `${params.componentName}-api-url`, {
      value: params.apiUrl,
      description: 'URL of the recommender API',
    });

    new CfnOutput(this, `${params.componentName}-alerts-topic-arn`, {
      value: params.alertsTopicArn,
      description: 'ARN of the SNS topic for recommender pipeline alerts',
    });

    new CfnOutput(this, `${params.componentName}-data-capture-uri`, {
      value: params.dataCaptureUri,
      description: 'S3 URI where endpoint data capture is stored',
    });
  }
}
