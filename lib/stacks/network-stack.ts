import { aws_ec2 as ec2, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface NetworkStackProps {
	environmentName: string;
}

export class NetworkStack extends Stack {
	public readonly vpc: ec2.Vpc;

	constructor(scope: Construct, id: string, props: NetworkStackProps) {
		super(scope, id);

		this.vpc = new ec2.Vpc(this, 'Vpc', {
			maxAzs: 2,
			natGateways: 1,
		});
	}
}
