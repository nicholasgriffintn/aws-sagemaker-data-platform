import { Duration } from 'aws-cdk-lib';
import { SecurityGroup, Vpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ModelAutoDeployProps {
  componentName: string;
  environmentName: string;
  pipelineName: string;
  pipelineRole: Role;
  vpc: Vpc;
  securityGroup: SecurityGroup;
  kmsKey: Key;
  endpointName: string;
  instanceType?: string;
  processedDataBucketName?: string;
  dataCapturePrefix?: string;
  useServerless?: boolean;
  serverlessMemorySizeMb?: number;
  serverlessMaxConcurrency?: number;
}

/**
 * Construct for automatic model deployment from Model Registry.
 *
 * Creates:
 * - EventBridge rule to trigger on model approval
 * - Lambda function to update the endpoint with approved models
 *
 * Note: The Model Package Group is created automatically by the SageMaker pipeline
 * when it first registers a model, so we don't create it here.
 */
export class ModelAutoDeploy extends Construct {
  public readonly deployerLambda: lambda.Function;
  public readonly deployerRole: Role;

  constructor(scope: Construct, id: string, props: ModelAutoDeployProps) {
    super(scope, id);

    const modelPackageGroupName = `${props.componentName}-${props.environmentName}-${props.pipelineName}-models`;

    this.deployerRole = new Role(this, 'DeployerRole', {
      roleName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-deployer-role`,
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    this.deployerRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    this.deployerRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DeleteNetworkInterface',
          'ec2:AssignPrivateIpAddresses',
          'ec2:UnassignPrivateIpAddresses',
        ],
        resources: ['*'],
      })
    );

    this.deployerRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'sagemaker:DescribeModelPackage',
          'sagemaker:DescribeModelPackageGroup',
          'sagemaker:ListModelPackages',
          'sagemaker:CreateModel',
          'sagemaker:DescribeModel',
          'sagemaker:DeleteModel',
          'sagemaker:CreateEndpointConfig',
          'sagemaker:DescribeEndpointConfig',
          'sagemaker:DeleteEndpointConfig',
          'sagemaker:CreateEndpoint',
          'sagemaker:DescribeEndpoint',
          'sagemaker:UpdateEndpoint',
        ],
        resources: ['*'],
      })
    );

    this.deployerRole.addToPolicy(
      new PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [props.pipelineRole.roleArn],
      })
    );

    props.kmsKey.grantEncryptDecrypt(this.deployerRole);

    this.deployerRole.addToPolicy(
      new PolicyStatement({
        actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
        resources: ['*'],
      })
    );

    this.deployerLambda = new lambda.Function(this, 'DeployerLambda', {
      functionName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-model-deployer`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambdas/model-deployer', {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
        },
      }),
      role: this.deployerRole,
      timeout: Duration.minutes(5),
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
        ENDPOINT_NAME: props.endpointName,
        COMPONENT_NAME: props.componentName,
        ENVIRONMENT_NAME: props.environmentName,
        SAGEMAKER_EXECUTION_ROLE_ARN: props.pipelineRole.roleArn,
        INSTANCE_TYPE: props.instanceType ?? 'ml.m5.large',
        KMS_KEY_ID: props.kmsKey.keyId,
        PROCESSED_DATA_BUCKET: props.processedDataBucketName ?? '',
        DATA_CAPTURE_PREFIX:
          props.dataCapturePrefix ??
          `${props.pipelineName}-pipeline/data-capture/`,
        USE_SERVERLESS: props.useServerless ? 'true' : 'false',
        SERVERLESS_MEMORY_SIZE_MB:
          props.serverlessMemorySizeMb?.toString() ?? '2048',
        SERVERLESS_MAX_CONCURRENCY:
          props.serverlessMaxConcurrency?.toString() ?? '5',
        SECURITY_GROUP_ID: props.securityGroup.securityGroupId,
        SUBNET_IDS: props.vpc.privateSubnets.map((s) => s.subnetId).join(','),
      },
    });

    const modelApprovalRule = new Rule(this, 'ModelApprovalRule', {
      ruleName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-model-approval`,
      description: `Trigger deployment when model is approved in ${modelPackageGroupName}`,
      eventPattern: {
        source: ['aws.sagemaker'],
        detailType: ['SageMaker Model Package State Change'],
        detail: {
          ModelPackageGroupName: [modelPackageGroupName],
          ModelApprovalStatus: ['Approved'],
        },
      },
    });

    modelApprovalRule.addTarget(new LambdaFunction(this.deployerLambda));
  }
}
