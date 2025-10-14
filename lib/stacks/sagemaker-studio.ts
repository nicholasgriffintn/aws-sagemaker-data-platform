import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from 'constructs';
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Key } from "aws-cdk-lib/aws-kms";
import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { CfnDomain, CfnDomainProps } from "aws-cdk-lib/aws-sagemaker";
import { Role } from "aws-cdk-lib/aws-iam";

export interface SagemakerStudioStackProps extends StackProps {
	environmentName: string;
	componentName: string;
  readonly vpc: Vpc;
  readonly securityGroup: SecurityGroup;
  readonly dataBucket: Bucket;
  readonly dataKey: Key;
  readonly executionRole: Role;
  private: boolean;
}

export class SagemakerStudioStack extends Stack {
  public domain: CfnDomain;

	constructor(scope: Construct, id: string, props: SagemakerStudioStackProps) {
		super(scope, id, props);

    const domainConfig: CfnDomainProps = {
      domainName: `${props.componentName}-${props.environmentName}-sagemaker-studio`,
      authMode: 'IAM',
      appNetworkAccessType: props.private ? 'VpcOnly' : 'PublicInternetOnly',
      defaultUserSettings: {
        securityGroups: [props.securityGroup.securityGroupId],
        executionRole: props.executionRole as unknown as string, // For some reason, the type here is string...
      },
      kmsKeyId: props.dataKey.keyId,
      vpcId: props.vpc.vpcId,
      subnetIds: props.private ? props.vpc.isolatedSubnets.map(subnet => subnet.subnetId) : props.vpc.privateSubnets.map(subnet => subnet.subnetId),
    };

    this.domain = new CfnDomain(this, `${props.componentName}-sagemaker-studio-domain`, domainConfig);

    new CfnOutput(this, `${ props.componentName }-sagemaker-studio-domain-id`, {
      value: this.domain.attrDomainId,
      description: 'The ID of the Sagemaker Studio domain',
    });
	}
}
