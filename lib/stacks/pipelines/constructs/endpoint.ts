import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Role } from "aws-cdk-lib/aws-iam";
import { CfnEndpoint, CfnEndpointConfig, CfnModel } from "aws-cdk-lib/aws-sagemaker";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { ExperimentEndpointMonitoring, ExperimentEndpointMonitoringProps } from "./monitoring";

export interface ExperimentEndpointProps {
	componentName: string;
	environmentName: string;
	processedDataBucket: Bucket;
	codeBucket: Bucket;
	pipelineRole: Role;
	vpc: Vpc;
	securityGroup: SecurityGroup;
	dataCapturePrefix?: string;
	modelArtifactsPath?: string;
	sagemakerImageUri: string;
	kmsKeyId: string;
	primaryInstanceType: string;
	monitoring?: Omit<ExperimentEndpointMonitoringProps, "endpointName" | "componentName" | "environmentName">;
}

export interface ExperimentEndpointResources {
	model: CfnModel;
	endpointConfig: CfnEndpointConfig;
	endpoint: CfnEndpoint;
	alertsTopic: Topic;
}

export class ExperimentEndpoint extends Construct {
	public readonly resources: ExperimentEndpointResources;

	constructor(scope: Construct, id: string, props: ExperimentEndpointProps) {
		super(scope, id);

		const modelDataUrl = props.modelArtifactsPath
			?? `s3://${props.processedDataBucket.bucketName}/experiment-pipeline/models/model.tar.gz`;

		const model = new CfnModel(this, "ExperimentModel", {
			modelName: `${props.componentName}-${props.environmentName}-experiment-model`,
			executionRoleArn: props.pipelineRole.roleArn,
			primaryContainer: {
				image: props.sagemakerImageUri,
				modelDataUrl,
				environment: {
					"SAGEMAKER_PROGRAM": "sagemaker-scripts/experiment-pipeline/inference/inference.py",
					"SAGEMAKER_SUBMIT_DIRECTORY": `s3://${props.codeBucket.bucketName}/`,
				},
			},
			vpcConfig: {
				securityGroupIds: [props.securityGroup.securityGroupId],
				subnets: props.vpc.privateSubnets.map((subnet) => subnet.subnetId),
			},
		});

		const dataCapturePrefix = props.dataCapturePrefix
			?? `experiment-pipeline/data-capture/`;

		const endpointConfig = new CfnEndpointConfig(this, "ExperimentEndpointConfig", {
			endpointConfigName: `${props.componentName}-${props.environmentName}-experiment-endpoint-config`,
			productionVariants: [{
				modelName: model.modelName || `${props.componentName}-${props.environmentName}-experiment-model`,
				variantName: "primary",
				initialInstanceCount: 1,
				instanceType: props.primaryInstanceType,
				initialVariantWeight: 1,
			}],
			kmsKeyId: props.kmsKeyId,
			dataCaptureConfig: {
				enableCapture: true,
				initialSamplingPercentage: 100,
				destinationS3Uri: `s3://${props.processedDataBucket.bucketName}/${dataCapturePrefix}`,
				kmsKeyId: props.kmsKeyId,
				captureOptions: [
					{ captureMode: "Input" },
					{ captureMode: "Output" },
				],
				captureContentTypeHeader: {
					jsonContentTypes: ["application/json"],
					csvContentTypes: ["text/csv"],
				},
			},
		});

		endpointConfig.addDependency(model);

		const endpoint = new CfnEndpoint(this, "ExperimentEndpoint", {
			endpointName: `${props.componentName}-${props.environmentName}-experiment-endpoint`,
			endpointConfigName: endpointConfig.endpointConfigName ?? `${props.componentName}-${props.environmentName}-experiment-endpoint-config`,
		});
		endpoint.addDependency(endpointConfig);

		const monitoring = new ExperimentEndpointMonitoring(this, "EndpointMonitoring", {
			componentName: props.componentName,
			environmentName: props.environmentName,
			endpointName: endpoint.attrEndpointName ?? `${props.componentName}-${props.environmentName}-experiment-endpoint`,
			...(props.monitoring ?? {}),
		});

		this.resources = {
			model,
			endpointConfig,
			endpoint,
			alertsTopic: monitoring.alertsTopic,
		};
	}
}
