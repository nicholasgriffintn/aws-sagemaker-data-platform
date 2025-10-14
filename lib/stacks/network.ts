import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
	GatewayVpcEndpointAwsService,
	InterfaceVpcEndpointAwsService,
	SecurityGroup,
	SubnetType,
	Vpc
} from "aws-cdk-lib/aws-ec2";

export interface NetworkStackProps extends StackProps {
	environmentName: string;
	componentName: string;
	private: boolean;
}

export class NetworkStack extends Stack {
	public readonly vpc: Vpc;
	public readonly sagemakerStudioSg: SecurityGroup;

	constructor(scope: Construct, id: string, props: NetworkStackProps) {
		super(scope, id, props);

		this.vpc = new Vpc(this, `${props.componentName}-vpc`, {
			vpcName: `${props.componentName}-${props.environmentName}-vpc`,
			maxAzs: 2,
			natGateways: props.private ? 0 : 1,
			subnetConfiguration: props.private ? [
				{
					name: 'private-isolated',
					subnetType: SubnetType.PRIVATE_ISOLATED,
				},
			] : [
				{
					name: 'public',
					subnetType: SubnetType.PUBLIC,
				},
				{
					name: 'private-with-egress',
					subnetType: SubnetType.PRIVATE_WITH_EGRESS,
				},
			],
		});

		if (props.private) {
			const interfaceServices = [
				{
					name: 'sts',
					service: InterfaceVpcEndpointAwsService.STS,
				},
				{
					name: 'logs',
					service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
				},
				{
					name: 'sagemaker-studio',
					service: InterfaceVpcEndpointAwsService.SAGEMAKER_STUDIO,
				},
				{
					name: 'sagemaker-api',
					service: InterfaceVpcEndpointAwsService.SAGEMAKER_API,
				},
				{
					name: 'sagemaker-runtime',
					service: InterfaceVpcEndpointAwsService.SAGEMAKER_RUNTIME,
				},
				{
					name: 'ecr-dkr',
					service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
				},
				{
					name: 'ecr-api',
					service: InterfaceVpcEndpointAwsService.ECR,
				}
			]

			interfaceServices.forEach(service => {
				this.vpc.addInterfaceEndpoint(`${props.componentName}-${service.name}-endpoint`, {
					service: service.service,
					securityGroups: [this.sagemakerStudioSg],
					subnets: {
						subnets: this.vpc.isolatedSubnets
					},
					privateDnsEnabled: true,
				});
			});

			this.vpc.addGatewayEndpoint(
				`${props.componentName}-s3`,
				{
					service: GatewayVpcEndpointAwsService.S3,
					subnets: [
						{
							subnets: this.vpc.isolatedSubnets
						}
					]
				}
			);
		}

		this.sagemakerStudioSg = new SecurityGroup(this, 'SagemakerStudioSecurityGroup', {
			vpc: this.vpc,
			securityGroupName: `${props.componentName}-${props.environmentName}-sagemaker-studio-sg`,
			description: 'Security group for Sagemaker Studio and jobs that run within it.',
			allowAllOutbound: true,
		});

		new CfnOutput(this, `${ props.componentName }-vpc-id`, {
			value: this.vpc.vpcId,
			description: 'The ID of the VPC',
		});

		new CfnOutput(this, `${ props.componentName }-sagemaker-studio-security-group-id`, {
			value: this.sagemakerStudioSg.securityGroupId,
			description: 'The ID of the Sagemaker Studio security group',
		});
	}
}
