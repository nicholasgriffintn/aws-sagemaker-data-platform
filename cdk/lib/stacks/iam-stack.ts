import { ArnFormat, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from 'constructs';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";

export interface IamStackProps extends StackProps {
	environmentName: string;
	componentName: string;
}

/**
 * Stack for creating IAM roles for the application.
 *
 * Creates:
 * - SageMaker Execution Role
 * - SageMaker Job Role
 * - Pipeline Role
 * - Lambda Execution Role
 */
export class IamStack extends Stack {
  public sagemakerExecutionRole: Role;
  public sagemakerJobRole: Role;
  public pipelineRole: Role;
  public lambdaExecutionRole: Role;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);

    const stack = Stack.of(this);
    const sagemakerLogGroupArn = stack.formatArn({
      service: 'logs',
      resource: 'log-group',
      resourceName: '/aws/sagemaker/*',
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });
    const sagemakerLogStreamArn = stack.formatArn({
      service: 'logs',
      resource: 'log-group',
      resourceName: '/aws/sagemaker/*:log-stream:*',
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });
    const glueCatalogArn = stack.formatArn({
      service: 'glue',
      resource: 'catalog',
    });

    this.sagemakerExecutionRole = new Role(
      this,
      `${props.componentName}-${props.environmentName}-studio-exec-role`,
      {
        assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
        roleName: `${props.componentName}-studio-exec-role`,
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
          ManagedPolicy.fromAwsManagedPolicyName(
            'AmazonSageMakerFeatureStoreAccess'
          ),
        ],
      }
    );

    this.sagemakerJobRole = new Role(
      this,
      `${props.componentName}-${props.environmentName}-sm-job-role`,
      {
        roleName: `${props.componentName}-sm-job-role`,
        assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName(
            'AmazonEC2ContainerRegistryReadOnly'
          ),
        ],
      }
    );
    this.sagemakerJobRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [sagemakerLogGroupArn, sagemakerLogStreamArn],
      })
    );
    this.sagemakerJobRole.addToPolicy(
      new PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );
    this.sagemakerJobRole.addToPolicy(
      new PolicyStatement({
        actions: ['lakeformation:GetDataAccess'],
        resources: [glueCatalogArn],
      })
    );

    this.sagemakerExecutionRole.addToPolicy(
      new PolicyStatement({
        actions: ['lakeformation:GetDataAccess'],
        resources: [glueCatalogArn],
      })
    );

    this.pipelineRole = new Role(
      this,
      `${props.componentName}-${props.environmentName}-pipeline-role`,
      {
        roleName: `${props.componentName}-pipeline-role`,
        assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
      }
    );
    this.pipelineRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'sagemaker:CreateTrainingJob',
          'sagemaker:CreateModel',
          'sagemaker:CreateEndpointConfig',
          'sagemaker:CreateEndpoint',
          'sagemaker:DescribeTrainingJob',
          'sagemaker:DescribeModel',
          'sagemaker:DescribeEndpointConfig',
          'sagemaker:DescribeEndpoint',
          'sagemaker:UpdateEndpoint',
          'sagemaker:InvokeEndpoint',
          'sagemaker:CreateProcessingJob',
          'sagemaker:DescribeProcessingJob',
          'sagemaker:CreateTransformJob',
          'sagemaker:DescribeTransformJob',
          'sagemaker:CreateHyperParameterTuningJob',
          'sagemaker:DescribeHyperParameterTuningJob',
          'sagemaker:ListTrainingJobs',
          'sagemaker:ListModels',
          'sagemaker:ListEndpointConfigs',
          'sagemaker:ListEndpoints',
          'sagemaker:ListProcessingJobs',
          'sagemaker:ListTransformJobs',
          'sagemaker:ListHyperParameterTuningJobs',
          'sagemaker:StopTrainingJob',
          'sagemaker:StopProcessingJob',
          'sagemaker:StopTransformJob',
          'sagemaker:DescribeHyperParameterTuningJob',
          'sagemaker:ListTags',
          'sagemaker:AddTags',
          'sagemaker:DeleteTags',
          'sagemaker:CreateCompilationJob',
          'sagemaker:DescribeCompilationJob',
          'sagemaker:ListCompilationJobs',
          'sagemaker:CreateAutoMLJob',
          'sagemaker:DescribeAutoMLJob',
          'sagemaker:ListAutoMLJobs',
          'sagemaker:CreateModelPackageGroup',
          'sagemaker:DescribeModelPackageGroup',
          'sagemaker:ListModelPackageGroups',
          'sagemaker:CreateModelPackage',
          'sagemaker:DescribeModelPackage',
          'sagemaker:ListModelPackages',
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'events:PutEvents',
          'ec2:CreateNetworkInterface',
          'ec2:CreateNetworkInterfacePermission',
          'ec2:DeleteNetworkInterface',
          'ec2:DeleteNetworkInterfacePermission',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DescribeSubnets',
          'ec2:DescribeSecurityGroups',
          'ec2:DescribeVpcs',
          'ec2:DescribeDhcpOptions',
        ],
        resources: ['*'],
      })
    );
    this.pipelineRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [sagemakerLogGroupArn, sagemakerLogStreamArn],
      })
    );
    this.pipelineRole.addToPolicy(
      new PolicyStatement({
        actions: ['lakeformation:GetDataAccess'],
        resources: [glueCatalogArn],
      })
    );
    this.pipelineRole.addToPolicy(
      new PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [this.sagemakerJobRole.roleArn, this.pipelineRole.roleArn],
      })
    );

    this.lambdaExecutionRole = new Role(
      this,
      `${props.componentName}-${props.environmentName}-lambda-exec-role`,
      {
        roleName: `${props.componentName}-lambda-exec-role`,
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole'
          ),
          ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaVPCAccessExecutionRole'
          ),
          ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
        ],
      }
    );

    this.lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        actions: ['sagemaker:InvokeEndpoint', 'sagemaker:DescribeEndpoint'],
        resources: [
          stack.formatArn({
            service: 'sagemaker',
            resource: 'endpoint',
            resourceName: `${props.componentName}-*`,
          }),
        ],
      })
    );

    this.lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:BatchGetItem',
        ],
        resources: [
          stack.formatArn({
            service: 'dynamodb',
            resource: 'table',
            resourceName: `${props.componentName}-*`,
          }),
        ],
      })
    );

    this.lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'sagemaker:GetRecord',
          'sagemaker:BatchGetRecord',
          'sagemaker:DescribeFeatureGroup',
        ],
        resources: [
          stack.formatArn({
            service: 'sagemaker',
            resource: 'feature-group',
            resourceName: `${props.componentName}-*`,
          }),
        ],
      })
    );

    this.lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          stack.formatArn({
            service: 'bedrock',
            resource: 'inference-profile',
            resourceName: '*',
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
          `arn:aws:bedrock:*:${stack.account}:inference-profile/*`,
        ],
      })
    );

    this.lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          stack.formatArn({
            service: 'logs',
            resource: 'log-group',
            resourceName: `/aws/lambda/${props.componentName}-*`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
          stack.formatArn({
            service: 'logs',
            resource: 'log-group',
            resourceName: `/aws/lambda/${props.componentName}-*:log-stream:*`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      })
    );

    this.lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [
          stack.formatArn({
            service: 'kms',
            resource: 'key',
            resourceName: '*',
          }),
        ],
        conditions: {
          StringLike: {
            'kms:ViaService': `dynamodb.${stack.region}.amazonaws.com`,
          },
        },
      })
    );
  }
}
