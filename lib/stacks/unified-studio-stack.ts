import { Construct } from 'constructs';
import {
	CfnOutput,
	aws_ec2 as ec2,
	aws_iam as iam,
	aws_sagemaker as sagemaker,
	aws_s3 as s3,
	aws_glue as glue,
	aws_athena as athena,
	aws_bedrock as bedrock,
	Stack
} from 'aws-cdk-lib';

export interface UnifiedStudioStackProps {
	environmentName: string;
	vpc: ec2.IVpc;
	domainName: string;
	appNetworkAccessType: 'PublicInternetOnly' | 'VpcOnly';
	enableUnifiedStudio: boolean;
	studioWebPortalAccess: 'ENABLED' | 'DISABLED';
	projectBucket: s3.IBucket;
	projectS3Prefix: string;
	glueDatabase?: glue.CfnDatabase;
	athenaWorkGroup?: athena.CfnWorkGroup;
	bedrockKnowledgeBase?: bedrock.CfnKnowledgeBase;
	bedrockGuardrail?: bedrock.CfnGuardrail;
}

export class UnifiedStudioStack extends Stack {
	public readonly domain: sagemaker.CfnDomain;

	constructor(scope: Construct, id: string, props: UnifiedStudioStackProps) {
		super(scope, id);

		const executionRole = new iam.Role(this, 'SageMakerExecutionRole', {
			assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
			description: 'Execution role for SageMaker Unified Studio apps',
		});

		executionRole.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
		);
		
		props.projectBucket.grantReadWrite(executionRole);

		executionRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: [
				'glue:GetDatabase',
				'glue:GetDatabases',
				'glue:GetTable',
				'glue:GetTables',
				'glue:GetPartition',
				'glue:GetPartitions',
				'glue:StartCrawler',
				'glue:GetCrawler',
				'glue:GetCrawlers',
				'glue:StartJobRun',
				'glue:GetJob',
				'glue:GetJobs',
				'glue:GetJobRun',
				'glue:GetJobRuns',
			],
			resources: ['*'],
		}));

		executionRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: [
				'athena:StartQueryExecution',
				'athena:StopQueryExecution',
				'athena:GetQueryExecution',
				'athena:GetQueryResults',
				'athena:ListQueryExecutions',
				'athena:GetWorkGroup',
				'athena:ListWorkGroups',
				'athena:GetDataCatalog',
				'athena:ListDataCatalogs',
			],
			resources: ['*'],
		}));

		executionRole.addToPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: [
					"bedrock:InvokeModel",
					"bedrock:InvokeModelWithResponseStream",
					"bedrock:ListFoundationModels",
					"bedrock:GetFoundationModel",
					"bedrock:Retrieve",
					"bedrock:RetrieveAndGenerate",
					"bedrock:GetKnowledgeBase",
					"bedrock:ListKnowledgeBases",
					"bedrock:GetGuardrail",
					"bedrock:ListGuardrails",
				],
				resources: ["*"],
			}),
		);

		executionRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: [
				'emr:ListClusters',
				'emr:DescribeCluster',
				'emr:ListSteps',
				'emr:DescribeStep',
				'emr:AddJobFlowSteps',
				'emr:ListInstances',
				'emr:ListInstanceGroups',
			],
			resources: ['*'],
		}));

		executionRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: [
				'redshift:DescribeClusters',
				'redshift:GetClusterCredentials',
				'redshift-data:ExecuteStatement',
				'redshift-data:DescribeStatement',
				'redshift-data:GetStatementResult',
				'redshift-data:ListStatements',
			],
			resources: ['*'],
		}));

		const privateSubnets = props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS });

		const sanitizedPrefix = props.projectS3Prefix.replace(/^\/+|\/+$/g, '');
		const projectS3Uri = sanitizedPrefix
			? `s3://${props.projectBucket.bucketName}/${sanitizedPrefix}/`
			: `s3://${props.projectBucket.bucketName}/`;

		const defaultUserSettings: sagemaker.CfnDomain.UserSettingsProperty = {
			executionRole: executionRole.roleArn,
		};

		const domainProps: sagemaker.CfnDomainProps = {
			authMode: 'IAM',
			domainName: props.domainName,
			appNetworkAccessType: props.appNetworkAccessType,
			vpcId: props.vpc.vpcId,
			subnetIds: privateSubnets.subnetIds,
			defaultUserSettings,
		};

		this.domain = new sagemaker.CfnDomain(this, 'Domain', domainProps);

		if (props.enableUnifiedStudio) {
			const unifiedStudioSettingsProperty: sagemaker.CfnDomain.UnifiedStudioSettingsProperty = {
				domainAccountId: this.domain.attrDomainId,
				domainId: this.domain.attrDomainId,
				domainRegion: this.region,
				environmentId: props.environmentName,
				projectId: props.projectS3Prefix,
				projectS3Path: projectS3Uri,
				singleSignOnApplicationArn: 'singleSignOnApplicationArn',
				studioWebPortalAccess: props.studioWebPortalAccess,
			};
			// TODO: This doesn't seem to be correct, erroring with:
			// extraneous key [UnifiedStudioSettings] is not permitted
			this.domain.addPropertyOverride('UnifiedStudioSettings', unifiedStudioSettingsProperty);
		}

		const userProfile = new sagemaker.CfnUserProfile(this, 'UserProfileDataScientist', {
			domainId: this.domain.attrDomainId,
			userProfileName: 'data-scientist',
			userSettings: {
				executionRole: executionRole.roleArn,
			},
		});
		userProfile.addDependency(this.domain);

		new CfnOutput(this, 'SageMakerDomainId', { 
			value: this.domain.attrDomainId,
			description: 'SageMaker Domain ID for Unified Studio',
		});
		
		new CfnOutput(this, 'SageMakerDomainArn', { 
			value: `arn:aws:sagemaker:${this.region}:${this.account}:domain/${this.domain.attrDomainId}`,
			description: 'SageMaker Domain ARN',
		});

		new CfnOutput(this, 'SageMakerExecutionRoleArn', {
			value: executionRole.roleArn,
			description: 'SageMaker execution role with comprehensive AWS service permissions',
		});

		new CfnOutput(this, 'UnifiedStudioProjectS3Uri', {
			value: projectS3Uri,
			description: 'S3 URI for Unified Studio project artifacts',
		});

		if (props.glueDatabase) {
			new CfnOutput(this, 'IntegratedGlueDatabase', {
				value: props.glueDatabase.ref,
				description: 'Integrated Glue database for data catalog',
			});
		}

		if (props.athenaWorkGroup) {
			new CfnOutput(this, 'IntegratedAthenaWorkGroup', {
				value: props.athenaWorkGroup.name!,
				description: 'Integrated Athena workgroup for SQL analytics',
			});
		}

		if (props.bedrockKnowledgeBase) {
			new CfnOutput(this, 'IntegratedBedrockKnowledgeBase', {
				value: props.bedrockKnowledgeBase.attrKnowledgeBaseId,
				description: 'Integrated Bedrock Knowledge Base for RAG applications',
			});
		}
	}
}
