#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { DataPlatformStack } from '../lib/data-platform-stack';

function getEnv(): string {
	const ctx = process.env.CDK_CONTEXT_JSON ? JSON.parse(process.env.CDK_CONTEXT_JSON) : {};
	return (ctx.env as string) || (process.env.CDK_ENV as string) || (process.env.npm_config_env as string) || 'dev';
}

const app = new App();
const envName = app.node.tryGetContext('env') || getEnv();

new DataPlatformStack(app, `AWSSagemakerDataPlatform-${envName}`, {
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.CDK_DEFAULT_REGION,
	},
	environmentName: envName,
});
