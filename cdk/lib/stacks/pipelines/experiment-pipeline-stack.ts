import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { CfnEndpoint, CfnPipeline } from 'aws-cdk-lib/aws-sagemaker';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

import { PipelineScriptLocations } from './types';
import { Endpoint } from './constructs/endpoint';
import { SageMakerPipeline } from './constructs/sagemaker-pipeline';
import { getSageMakerImageUri } from '../pipelines/utils/sagemaker';
import {
  ApiSecurity,
  createCorsEnabledApi,
  addSecureMethod,
} from './constructs/api-security';
import { ModelAutoDeploy } from './constructs/model-auto-deploy';
import { MLDashboard } from './constructs/ml-dashboard';
import { ScheduledRetraining } from './constructs/scheduled-retraining';

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
  readonly userFeaturesTableName: string;
  readonly featureGroupName: string;
  readonly alertEmail?: string;
  readonly enableApiSecurity?: boolean;
  readonly enableScheduledRetraining?: boolean;
  readonly retrainingSchedule?: string;
  readonly enableModelAutoDeploy?: boolean;
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

    const lambdaFunctionName = `${props.componentName}-${props.environmentName}-bucketing`;

    const bucketingLambda = new lambda.Function(this, 'BucketingLambda', {
      functionName: lambdaFunctionName,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambdas/bucketing', {
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
      memorySize: 256,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType:
          props.vpc.privateSubnets.length > 0
            ? SubnetType.PRIVATE_WITH_EGRESS
            : SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.securityGroup],
      tracing: Tracing.ACTIVE,
      environment: {
        ENDPOINT_NAME: endpoint.resources.endpoint.endpointName!,
        FEATURE_SOURCE: 'mock',
        DYNAMODB_TABLE: props.userFeaturesTableName,
        FEATURE_GROUP_NAME: props.featureGroupName,
        AWS_REGION: this.region,
        AWS_XRAY_DAEMON_ADDRESS: '127.0.0.1:2000',
        AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
      },
    });

    this.api = createCorsEnabledApi(this, 'BucketingApi', {
      restApiName: `${props.componentName}-${props.environmentName}-User-Bucketing`,
      description: 'API for user bucketing and experiment assignment',
    });

    const bucketResource = this.api.root.addResource('bucket');
    const enableApiSecurity = props.enableApiSecurity ?? true;

    if (enableApiSecurity) {
      addSecureMethod(
        bucketResource,
        'POST',
        new apigw.LambdaIntegration(bucketingLambda)
      );

      const apiSecurity = new ApiSecurity(this, 'BucketingApiSecurity', {
        componentName: props.componentName,
        environmentName: props.environmentName,
        api: this.api,
        apiName: 'bucketing',
        rateLimit: 100,
        burstLimit: 200,
        quotaLimit: 10000,
      });
    } else {
      bucketResource.addMethod(
        'POST',
        new apigw.LambdaIntegration(bucketingLambda)
      );
    }

    if (props.enableModelAutoDeploy ?? true) {
      new ModelAutoDeploy(this, 'BucketingModelAutoDeploy', {
        componentName: props.componentName,
        environmentName: props.environmentName,
        pipelineName,
        pipelineRole: props.pipelineRole,
        vpc: props.vpc,
        securityGroup: props.securityGroup,
        kmsKey: props.dataKey,
        endpointName: endpoint.resources.endpoint.endpointName!,
        instanceType: this.imageId,
      });
    }

    new MLDashboard(this, 'BucketingDashboard', {
      componentName: props.componentName,
      environmentName: props.environmentName,
      pipelineName,
      endpointName: endpoint.resources.endpoint.endpointName!,
      lambdaFunctionName,
      apiName: `${props.componentName}-${props.environmentName}-User-Bucketing`,
    });

    if (props.enableScheduledRetraining) {
      new ScheduledRetraining(this, 'BucketingScheduledRetraining', {
        componentName: props.componentName,
        environmentName: props.environmentName,
        pipelineName,
        schedule: props.retrainingSchedule,
        enabled: true,
      });
    }

    if (props.alertEmail) {
      endpoint.resources.alertsTopic.addSubscription(
        new EmailSubscription(props.alertEmail)
      );
    }

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
