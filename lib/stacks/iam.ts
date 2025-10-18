import { ArnFormat, Stack, StackProps } from "aws-cdk-lib";
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
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [
        sagemakerLogGroupArn,
        sagemakerLogStreamArn,
      ],
    }));
    this.sagemakerJobRole.addToPolicy(new PolicyStatement({
      actions: [
        'ecr:GetAuthorizationToken'
      ],
      resources: [ '*' ],
    }));
    this.sagemakerJobRole.addToPolicy(new PolicyStatement({
      actions: [
        'lakeformation:GetDataAccess',
      ],
      resources: [ glueCatalogArn ],
    }));

    this.sagemakerExecutionRole.addToPolicy(new PolicyStatement({
      actions: [
        'lakeformation:GetDataAccess',
      ],
      resources: [ glueCatalogArn ],
    }));

    this.pipelineRole = new Role(this, `${ props.componentName }-${ props.environmentName }-pipeline-role`, {
      roleName: `${ props.componentName }-pipeline-role`,
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
    });
    this.pipelineRole.addToPolicy(new PolicyStatement({
      actions: [
        'sagemaker:*',
        'ecr:GetAuthorizationToken', 'ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage',
        'events:PutEvents',
      ],
      resources: [ '*' ],
    }));
    this.pipelineRole.addToPolicy(new PolicyStatement({
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [
        sagemakerLogGroupArn,
        sagemakerLogStreamArn,
      ],
    }));
    this.pipelineRole.addToPolicy(new PolicyStatement({
      actions: [
        'lakeformation:GetDataAccess',
      ],
      resources: [ glueCatalogArn ],
    }));
    this.pipelineRole.addToPolicy(new PolicyStatement({
      actions: [ 'iam:PassRole' ],
      resources: [ this.sagemakerJobRole.roleArn ],
    }));
	}
}
