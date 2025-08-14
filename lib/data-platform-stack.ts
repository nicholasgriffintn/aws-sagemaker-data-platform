import { Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

import { NetworkStack } from './stacks/network-stack';
import { DataLakeStack } from './stacks/datalake-stack';
import { GlueStack } from './stacks/glue-stack';
import { AthenaStack } from './stacks/athena-stack';
import { BedrockStack } from './stacks/bedrock-stack';
import { UnifiedStudioStack } from './stacks/unified-studio-stack';

export interface DataPlatformStackProps extends StackProps {
	environmentName: string;
}

interface EnvConfig {
	awsAccount: string;
	awsRegion: string;
	domainName: string;
	appNetworkAccessType: 'PublicInternetOnly' | 'VpcOnly';
	enableUnifiedStudio: boolean;
	studioWebPortalAccess: 'ENABLED' | 'DISABLED';
	projectS3Prefix: string;
	enableGlue: boolean;
	enableAthena: boolean;
	enableBedrock: boolean;
	enableBedrockKnowledgeBase: boolean;
	enableBedrockGuardrails: boolean;
}

function loadEnvConfig(envName: string): EnvConfig {
	const configPath = path.join(__dirname, `../config/environments/${envName}.json`);
	const raw = fs.readFileSync(configPath, 'utf-8');
	return JSON.parse(raw) as EnvConfig;
}

export class DataPlatformStack extends Stack {
	constructor(scope: Construct, id: string, props: DataPlatformStackProps) {
		super(scope, id, props);

		const cfg = loadEnvConfig(props.environmentName);
		Tags.of(this).add('Environment', props.environmentName);

		const network = new NetworkStack(this, 'Network', {
			environmentName: props.environmentName,
		});

		const dataLake = new DataLakeStack(this, 'DataLake', {
			environmentName: props.environmentName,
		});

		let glueStack: GlueStack | undefined;
		if (cfg.enableGlue) {
			glueStack = new GlueStack(this, 'Glue', {
				environmentName: props.environmentName,
				rawBucket: dataLake.rawBucket,
				curatedBucket: dataLake.curatedBucket,
				projectBucket: dataLake.projectBucket,
			});
		}

		let athenaStack: AthenaStack | undefined;
		if (cfg.enableAthena && glueStack) {
			athenaStack = new AthenaStack(this, 'Athena', {
				environmentName: props.environmentName,
				queryResultsBucket: dataLake.projectBucket,
				glueDatabase: glueStack.database,
			});
		}

		let bedrockStack: BedrockStack | undefined;
		if (cfg.enableBedrock) {
			bedrockStack = new BedrockStack(this, 'Bedrock', {
				environmentName: props.environmentName,
				projectBucket: dataLake.projectBucket,
				enableKnowledgeBase: cfg.enableBedrockKnowledgeBase,
				enableGuardrails: cfg.enableBedrockGuardrails,
			});
		}

		new UnifiedStudioStack(this, 'UnifiedStudio', {
			environmentName: props.environmentName,
			vpc: network.vpc,
			domainName: cfg.domainName,
			appNetworkAccessType: cfg.appNetworkAccessType,
			enableUnifiedStudio: cfg.enableUnifiedStudio,
			studioWebPortalAccess: cfg.studioWebPortalAccess,
			projectBucket: dataLake.projectBucket,
			projectS3Prefix: cfg.projectS3Prefix,
			glueDatabase: glueStack?.database,
			athenaWorkGroup: athenaStack?.workGroup,
			bedrockKnowledgeBase: bedrockStack?.knowledgeBase,
			bedrockGuardrail: bedrockStack?.guardrail,
		});

		new CfnOutput(this, 'ProjectBucketName', {
			value: dataLake.projectBucket.bucketName,
			description: 'S3 bucket for project artifacts and data',
		});

		new CfnOutput(this, 'RawDataBucketName', {
			value: dataLake.rawBucket.bucketName,
			description: 'S3 bucket for raw data ingestion',
		});

		new CfnOutput(this, 'CuratedDataBucketName', {
			value: dataLake.curatedBucket.bucketName,
			description: 'S3 bucket for processed/curated data',
		});

		if (glueStack) {
			new CfnOutput(this, 'DataCatalogDatabaseRef', {
				value: glueStack.database.ref,
				description: 'Glue Data Catalog database for metadata management',
			});
		}

		if (athenaStack) {
			new CfnOutput(this, 'AthenaWorkGroupName', {
				value: athenaStack.workGroup.name!,
				description: 'Athena WorkGroup for SQL analytics',
			});
		}

		if (bedrockStack?.knowledgeBase) {
			new CfnOutput(this, 'BedrockKnowledgeBaseId', {
				value: bedrockStack.knowledgeBase.attrKnowledgeBaseId,
				description: 'Bedrock Knowledge Base for RAG applications',
			});
		}
	}
}
