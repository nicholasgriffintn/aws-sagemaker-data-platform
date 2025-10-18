import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";

export interface CodeDeploymentStackProps extends StackProps {
	environmentName: string;
	componentName: string;
	readonly codeBucket: Bucket;
}

export class CodeDeploymentStack extends Stack {
	public readonly sagemakerScriptsDeployment: BucketDeployment;

	constructor(scope: Construct, id: string, props: CodeDeploymentStackProps) {
		super(scope, id, props);

		this.sagemakerScriptsDeployment = new BucketDeployment(this, `${props.componentName}-sagemaker-scripts-deployment`, {
			sources: [Source.asset('sagemaker-scripts')],
			destinationBucket: props.codeBucket,
			destinationKeyPrefix: 'sagemaker-scripts/',
			retainOnDelete: false,
			prune: true,
		});

		new CfnOutput(this, `${props.componentName}-sagemaker-scripts-path`, {
			value: `s3://${props.codeBucket.bucketName}/sagemaker-scripts/`,
			description: 'S3 path to SageMaker pipeline scripts'
		});
	}
}
