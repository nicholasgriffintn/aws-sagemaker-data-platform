import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from 'constructs';
import { CfnDomain, CfnUserProfile } from "aws-cdk-lib/aws-sagemaker";
import { SecurityGroup } from "aws-cdk-lib/aws-ec2";

export interface UserProfileStackProps extends StackProps {
	environmentName: string;
	componentName: string;
  readonly studioDomain: CfnDomain;
  readonly securityGroup: SecurityGroup;
}

/**
 * Stack for creating a user profile for the Sagemaker Studio domain.
 *
 * Creates:
 * - User profile for the root user
 * - Outputs for the user profile name
 */
export class UserProfileStack extends Stack {
  public userProfile: CfnUserProfile;

	constructor(scope: Construct, id: string, props: UserProfileStackProps) {
		super(scope, id, props);

    this.userProfile = new CfnUserProfile(this, `${ props.environmentName }-${ props.componentName }-user-root`, {
      domainId: props.studioDomain.attrDomainId,
      userProfileName: 'root',
      userSettings: {
        securityGroups: [ props.securityGroup.securityGroupId ],
      },
    });
    this.userProfile.addDependency(props.studioDomain);

    new CfnOutput(this, `${ props.environmentName }-${ props.componentName }-user-root-name`, {
      value: this.userProfile.userProfileName,
      description: 'The name of the root user profile',
    });
	}
}