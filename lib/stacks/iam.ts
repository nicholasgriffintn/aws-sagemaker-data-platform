import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from 'constructs';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";

export interface IamStackProps extends StackProps {
	environmentName: string;
	componentName: string;
}

export class IamStack extends Stack {
	public sagemakerExecutionRole: Role;
	public sagemakerJobRole: Role;
  public pipelineRole: Role;

	constructor(scope: Construct, id: string, props: IamStackProps) {
		super(scope, id, props);

    this.sagemakerExecutionRole = new Role(this, `${ props.componentName }-${ props.environmentName }-studio-exec-role`, {
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
      roleName: `${ props.componentName }-studio-exec-role`,
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });

    this.sagemakerJobRole = new Role(this, `${ props.componentName }-${ props.environmentName }-sm-job-role`, {
      roleName: `${ props.componentName }-sm-job-role`,
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly')
      ]
    });
    this.sagemakerJobRole.addToPolicy(new PolicyStatement({
      actions: [
        'logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents',
        'ecr:GetAuthorizationToken'
      ],
      resources: [ '*' ],
    }));

    this.pipelineRole = new Role(this, `${ props.componentName }-${ props.environmentName }-pipeline-role`, {
      roleName: `${ props.componentName }-pipeline-role`,
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
    });
    this.pipelineRole.addToPolicy(new PolicyStatement({
      actions: [
        'sagemaker:*',
        'iam:PassRole',
        's3:*',
        'kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey*', 'kms:DescribeKey',
        'logs:*',
        'ecr:GetAuthorizationToken', 'ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'
      ],
      resources: [ '*' ],
    }));
    this.pipelineRole.addToPolicy(new PolicyStatement({
      actions: [ 'iam:PassRole' ],
      resources: [ this.sagemakerJobRole.roleArn ],
    }));
	}
}