import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

import { NetworkStack } from './stacks/network';
import { IamStack } from './stacks/iam';
import { StorageStack } from './stacks/storage';
import { SagemakerStudioStack } from './stacks/sagemaker-studio';
import { UserProfileStack } from './stacks/user-profile';

export interface DataPlatformStackProps extends StackProps {
	environmentName: string;
}

interface EnvConfig {
	componentName: string;
	awsAccount: string;
	awsRegion: string;
	private: boolean;
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
			componentName: cfg.componentName,
			private: cfg.private,
		});

		const storage = new StorageStack(this, 'Storage', {
			environmentName: props.environmentName,
			componentName: cfg.componentName,
		});

		const iam = new IamStack(this, 'Iam', {
			environmentName: props.environmentName,
			componentName: cfg.componentName,
		});

		storage.rawDataBucket.grantReadWrite(iam.sagemakerJobRole);
		storage.kmsKey.grantEncryptDecrypt(iam.sagemakerJobRole);

		const sagemakerStudio = new SagemakerStudioStack(this, 'SagemakerStudio', {
			environmentName: props.environmentName,
			componentName: cfg.componentName,
			vpc: network.vpc,
			securityGroup: network.sagemakerStudioSg,
			dataBucket: storage.rawDataBucket,
			dataKey: storage.kmsKey,
			executionRole: iam.sagemakerExecutionRole,
			private: cfg.private,
		});

		new UserProfileStack(this, 'UserProfile', {
			environmentName: props.environmentName,
			componentName: cfg.componentName,
			studioDomain: sagemakerStudio.domain,
			securityGroup: network.sagemakerStudioSg,
		});
	}
}
