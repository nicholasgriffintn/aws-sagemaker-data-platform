import * as path from 'path';
import { CfnOutput, DockerVolume, Duration, Stack } from 'aws-cdk-lib';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { CfnEndpoint, CfnPipeline } from 'aws-cdk-lib/aws-sagemaker';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

import { PipelineStackProps } from '../../types';
import {
  API_LIMITS,
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
import { getSageMakerImageUri, SageMakerFramework } from './utils';

export interface MLPipelineConfig {
  pipelineName: string;
  apiResourcePath: string;
  apiDisplayName: string;
  apiDescription: string;
  lambdaCodePath: string;
  lambdaMemorySize?: number;
  scriptDirectory: string;
  lambdaEnvironment?: Record<string, string>;
  framework?: SageMakerFramework;
}

/**
 * Base class for creating a pipeline stack.
 *
 * Creates:
 * - Pipeline
 * - Endpoint
 * - API
 * - Model Auto Deploy
 * - Dashboard
 * - Scheduled Retraining
 */
export abstract class BasePipelineStack extends Stack {
  public readonly pipeline: CfnPipeline;
  public readonly endpoint?: CfnEndpoint;
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

    this.primaryInstanceType =
      props.instanceTypes?.primary ?? INSTANCE_TYPES.PRIMARY;
    this.secondaryInstanceType =
      props.instanceTypes?.secondary ?? INSTANCE_TYPES.SECONDARY;
    this.pipelineName = config.pipelineName;
    this.sagemakerImageUri = getSageMakerImageUri(
      this.region,
      config.framework
    );

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
        parameterOverrides: props.instanceTypes?.trainingPrimary
          ? {
              trainingInstanceType: props.instanceTypes.trainingPrimary,
            }
          : undefined,
        endpointInstanceTypes:
          props.instanceTypes?.endpointPrimary ||
          props.instanceTypes?.endpointSecondary
            ? {
                primary:
                  props.instanceTypes.endpointPrimary ??
                  this.primaryInstanceType,
                secondary:
                  props.instanceTypes.endpointSecondary ??
                  this.secondaryInstanceType,
              }
            : undefined,
      }
    );

    this.pipeline = sagemakerPipeline.pipeline;

    const deployEndpoint = props.endpointConfig?.deployEndpoint ?? false;
    const useServerlessEndpoint = props.endpointConfig?.useServerlessEndpoint ?? false;

    const endpointConstruct = deployEndpoint
      ? new Endpoint(this, `${config.pipelineName}Endpoint`, {
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
          useServerless: useServerlessEndpoint,
          serverlessMemorySizeMb: props.endpointConfig?.serverlessMemorySizeMb,
          serverlessMaxConcurrency:
            props.endpointConfig?.serverlessMaxConcurrency,
          monitoring: {
            pipelineName: config.pipelineName,
            invocationTargetValue: 100,
          },
          skipInitialModel: true,
        })
      : undefined;

    this.endpoint = endpointConstruct?.resources.endpoint;

    const lambdaFunctionName = `${props.componentName}-${props.environmentName}-${config.pipelineName}`;

    const sharedPackagePath = path.join(__dirname, '..', '..', '..', '..', 'shared', 'platform_shared');
    const sharedVolume: DockerVolume = {
      hostPath: sharedPackagePath,
      containerPath: '/shared/platform_shared',
    };

    const endpointName = deployEndpoint
      ? `${props.componentName}-${props.environmentName}-${config.pipelineName}-endpoint`
      : '';

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
            volumes: [sharedVolume],
            command: [
              'bash',
              '-c',
              'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output && cp -r /shared/platform_shared /asset-output/',
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
          ...(deployEndpoint && { ENDPOINT_NAME: endpointName }),
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
        rateLimit: API_LIMITS.DEFAULT_RATE_LIMIT,
        burstLimit: API_LIMITS.DEFAULT_BURST_LIMIT,
        quotaLimit: API_LIMITS.DEFAULT_QUOTA_LIMIT,
      });
    } else {
      apiResource.addMethod(
        'POST',
        new apigw.LambdaIntegration(pipelineLambda)
      );
    }

    if (deployEndpoint && !useServerlessEndpoint && (props.enableModelAutoDeploy ?? true)) {
      new ModelAutoDeploy(this, `${config.pipelineName}ModelAutoDeploy`, {
        componentName: props.componentName,
        environmentName: props.environmentName,
        pipelineName: config.pipelineName,
        pipelineRole: props.pipelineRole,
        vpc: props.vpc,
        securityGroup: props.securityGroup,
        kmsKey: props.dataKey,
        endpointName,
        instanceType: this.primaryInstanceType,
        processedDataBucketName: props.processedDataBucket.bucketName,
        dataCapturePrefix: `${config.pipelineName}-pipeline/data-capture/`,
        useServerless: useServerlessEndpoint,
        serverlessMemorySizeMb: props.endpointConfig?.serverlessMemorySizeMb,
        serverlessMaxConcurrency:
          props.endpointConfig?.serverlessMaxConcurrency,
      });
    }

    new MLDashboard(this, `${config.pipelineName}Dashboard`, {
      componentName: props.componentName,
      environmentName: props.environmentName,
      pipelineName: config.pipelineName,
      endpointName: deployEndpoint ? endpointName : undefined,
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

    if (deployEndpoint && props.alertEmail && endpointConstruct) {
      endpointConstruct.resources.alertsTopic.addSubscription(
        new EmailSubscription(props.alertEmail)
      );
    }

    this.registerOutputs({
      componentName: props.componentName,
      pipelineName: `${props.componentName}-${props.environmentName}-${pipelinePrefix}`,
      endpointName: deployEndpoint ? endpointName : undefined,
      apiUrl: this.api.url,
      dataCaptureUri: deployEndpoint
        ? `s3://${props.processedDataBucket.bucketName}/${pipelinePrefix}/data-capture/`
        : undefined,
      alertsTopicArn: endpointConstruct?.resources.alertsTopic.topicArn,
    });
  }

  private registerOutputs(params: {
    componentName: string;
    pipelineName: string;
    endpointName?: string;
    apiUrl: string;
    dataCaptureUri?: string;
    alertsTopicArn?: string;
  }): void {
    new CfnOutput(this, 'PipelineName', {
      value: params.pipelineName,
      exportName: `${this.stackName}-pipeline-name`,
    });

    if (params.endpointName) {
      new CfnOutput(this, 'EndpointName', {
        value: params.endpointName,
        exportName: `${this.stackName}-endpoint-name`,
      });
    }

    new CfnOutput(this, 'ApiUrl', {
      value: params.apiUrl,
      exportName: `${this.stackName}-api-url`,
    });

    if (params.alertsTopicArn) {
      new CfnOutput(this, 'AlertsTopicArn', {
        value: params.alertsTopicArn,
        exportName: `${this.stackName}-alerts-topic-arn`,
      });
    }

    if (params.dataCaptureUri) {
      new CfnOutput(this, 'DataCaptureUri', {
        value: params.dataCaptureUri,
        exportName: `${this.stackName}-data-capture-uri`,
      });
    }
  }
}
