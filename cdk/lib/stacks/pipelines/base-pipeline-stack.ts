import { CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { CfnEndpoint, CfnPipeline } from 'aws-cdk-lib/aws-sagemaker';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

import { PipelineStackProps } from '../../types';
import {
  INSTANCE_TYPES,
  LAMBDA_CONFIG,
  getPipelinePrefix,
} from '../../constants';
import { PipelineScriptLocations } from './types';
import {
  SageMakerPipeline,
  Endpoint,
  ApiSecurity,
  addSecureMethod,
  createCorsEnabledApi,
  ModelAutoDeploy,
  MLDashboard,
  ScheduledRetraining,
} from './constructs';
import { getSageMakerImageUri } from './utils';

export interface MLPipelineConfig {
  pipelineName: string;
  apiResourcePath: string;
  apiDisplayName: string;
  apiDescription: string;
  lambdaCodePath: string;
  lambdaMemorySize?: number;
  scriptDirectory: string;
  lambdaEnvironment?: Record<string, string>;
}

export abstract class BasePipelineStack extends Stack {
  public readonly pipeline: CfnPipeline;
  public readonly endpoint: CfnEndpoint;
  public readonly api: apigw.RestApi;
  public readonly primaryInstanceType: string;
  public readonly secondaryInstanceType: string;

  protected readonly pipelineName: string;
  protected readonly sagemakerImageUri: string;

  constructor(
    scope: Construct,
    id: string,
    props: PipelineStackProps,
    config: MLPipelineConfig
  ) {
    super(scope, id, props);

    this.primaryInstanceType = INSTANCE_TYPES.PRIMARY;
    this.secondaryInstanceType = INSTANCE_TYPES.SECONDARY;
    this.pipelineName = config.pipelineName;
    this.sagemakerImageUri = getSageMakerImageUri(this.region);

    const pipelinePrefix = getPipelinePrefix(config.pipelineName);

    props.codeBucket.grantRead(props.pipelineRole);

    const scriptLocations: PipelineScriptLocations = {
      preprocessing: `${config.scriptDirectory}/preprocess.py`,
      training: `${config.scriptDirectory}/train.py`,
      evaluation: `${config.scriptDirectory}/evaluate.py`,
      inference: `${config.scriptDirectory}/inference.py`,
    };

    const sagemakerPipeline = new SageMakerPipeline(
      this,
      `${config.pipelineName}TrainingPipeline`,
      {
        componentName: props.componentName,
        environmentName: props.environmentName,
        rawDataBucket: props.rawDataBucket,
        processedDataBucket: props.processedDataBucket,
        codeBucket: props.codeBucket,
        pipelineRole: props.pipelineRole,
        pipelineName: config.pipelineName,
        vpc: props.vpc,
        securityGroup: props.securityGroup,
        pipelineNameSuffix: pipelinePrefix,
        sagemakerImageUri: this.sagemakerImageUri,
        primaryInstanceType: this.primaryInstanceType,
        secondaryInstanceType: this.secondaryInstanceType,
        scriptLocations,
      }
    );

    this.pipeline = sagemakerPipeline.pipeline;

    const endpointConstruct = new Endpoint(
      this,
      `${config.pipelineName}Endpoint`,
      {
        componentName: props.componentName,
        environmentName: props.environmentName,
        processedDataBucket: props.processedDataBucket,
        codeBucket: props.codeBucket,
        pipelineRole: props.pipelineRole,
        pipelineName: config.pipelineName,
        vpc: props.vpc,
        securityGroup: props.securityGroup,
        sagemakerImageUri: this.sagemakerImageUri,
        modelInterfaceScript: `${config.scriptDirectory}/inference.py`,
        kmsKeyId: props.dataKey.keyId,
        primaryInstanceType: this.primaryInstanceType,
        monitoring: {
          pipelineName: config.pipelineName,
          invocationTargetValue: 100,
        },
      }
    );

    this.endpoint = endpointConstruct.resources.endpoint;

    const lambdaFunctionName = `${props.componentName}-${props.environmentName}-${config.pipelineName}`;

    const pipelineLambda = new lambda.Function(
      this,
      `${config.pipelineName}Lambda`,
      {
        functionName: lambdaFunctionName,
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'handler.handler',
        code: lambda.Code.fromAsset(config.lambdaCodePath, {
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
        timeout: Duration.seconds(LAMBDA_CONFIG.DEFAULT_TIMEOUT_SECONDS),
        memorySize: config.lambdaMemorySize ?? LAMBDA_CONFIG.DEFAULT_MEMORY_MB,
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
          ENDPOINT_NAME: endpointConstruct.resources.endpoint.endpointName!,
          AWS_XRAY_DAEMON_ADDRESS: '127.0.0.1:2000',
          AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
          ...config.lambdaEnvironment,
        },
      }
    );

    this.api = createCorsEnabledApi(this, `${config.pipelineName}Api`, {
      restApiName: `${props.componentName}-${props.environmentName}-${config.apiDisplayName}`,
      description: config.apiDescription,
    });

    const apiResource = this.api.root.addResource(config.apiResourcePath);
    const enableApiSecurity = props.enableApiSecurity ?? true;

    if (enableApiSecurity) {
      addSecureMethod(
        apiResource,
        'POST',
        new apigw.LambdaIntegration(pipelineLambda)
      );

      new ApiSecurity(this, `${config.pipelineName}ApiSecurity`, {
        componentName: props.componentName,
        environmentName: props.environmentName,
        api: this.api,
        apiName: config.pipelineName,
        rateLimit: 100,
        burstLimit: 200,
        quotaLimit: 10000,
      });
    } else {
      apiResource.addMethod(
        'POST',
        new apigw.LambdaIntegration(pipelineLambda)
      );
    }

    if (props.enableModelAutoDeploy ?? true) {
      new ModelAutoDeploy(this, `${config.pipelineName}ModelAutoDeploy`, {
        componentName: props.componentName,
        environmentName: props.environmentName,
        pipelineName: config.pipelineName,
        pipelineRole: props.pipelineRole,
        vpc: props.vpc,
        securityGroup: props.securityGroup,
        kmsKey: props.dataKey,
        endpointName: endpointConstruct.resources.endpoint.endpointName!,
        instanceType: this.primaryInstanceType,
      });
    }

    new MLDashboard(this, `${config.pipelineName}Dashboard`, {
      componentName: props.componentName,
      environmentName: props.environmentName,
      pipelineName: config.pipelineName,
      endpointName: endpointConstruct.resources.endpoint.endpointName!,
      lambdaFunctionName,
      apiName: `${props.componentName}-${props.environmentName}-${config.apiDisplayName}`,
    });

    if (props.enableScheduledRetraining) {
      new ScheduledRetraining(
        this,
        `${config.pipelineName}ScheduledRetraining`,
        {
          componentName: props.componentName,
          environmentName: props.environmentName,
          pipelineName: config.pipelineName,
          schedule: props.retrainingSchedule,
          enabled: true,
        }
      );
    }

    if (props.alertEmail) {
      endpointConstruct.resources.alertsTopic.addSubscription(
        new EmailSubscription(props.alertEmail)
      );
    }

    this.registerOutputs({
      componentName: props.componentName,
      pipelineName: `${props.componentName}-${props.environmentName}-${pipelinePrefix}`,
      endpointName: `${props.componentName}-${props.environmentName}-${config.pipelineName}-endpoint`,
      apiUrl: this.api.url,
      dataCaptureUri: `s3://${props.processedDataBucket.bucketName}/${pipelinePrefix}/data-capture/`,
      alertsTopicArn: endpointConstruct.resources.alertsTopic.topicArn,
    });
  }

  private registerOutputs(params: {
    componentName: string;
    pipelineName: string;
    endpointName: string;
    apiUrl: string;
    dataCaptureUri: string;
    alertsTopicArn: string;
  }): void {
    new CfnOutput(this, `${params.componentName}-pipeline-name`, {
      value: params.pipelineName,
    });

    new CfnOutput(this, `${params.componentName}-endpoint-name`, {
      value: params.endpointName,
    });

    new CfnOutput(this, `${params.componentName}-api-url`, {
      value: params.apiUrl,
    });

    new CfnOutput(this, `${params.componentName}-alerts-topic-arn`, {
      value: params.alertsTopicArn,
    });

    new CfnOutput(this, `${params.componentName}-data-capture-uri`, {
      value: params.dataCaptureUri,
    });
  }
}
