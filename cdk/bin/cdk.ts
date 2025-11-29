#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import * as path from 'path';
import * as fs from 'fs';

import { NetworkStack } from '../lib/stacks/network-stack';
import { IamStack } from '../lib/stacks/iam-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { GlueStack } from '../lib/stacks/glue-stack';
import { LakeFormationStack } from '../lib/stacks/lakeformation-stack';
import { SagemakerStudioStack } from '../lib/stacks/sagemaker-studio-stack';
import { UserProfileStack } from '../lib/stacks/user-profile-stack';
import { CodeDeploymentStack } from '../lib/stacks/code-deployment-stack';
import { ExperimentPipelineStack } from '../lib/stacks/pipelines/experiment-pipeline-stack';
import { RecommenderPipelineStack } from '../lib/stacks/pipelines/recommender-pipeline-stack';

interface EnvConfig {
  componentName: string;
  awsAccount: string;
  awsRegion: string;
  private: boolean;
}

function getEnv(): string {
  const ctx = process.env.CDK_CONTEXT_JSON
    ? JSON.parse(process.env.CDK_CONTEXT_JSON)
    : {};
  return (
    (ctx.env as string) ||
    (process.env.CDK_ENV as string) ||
    (process.env.npm_config_env as string) ||
    'dev'
  );
}

function loadEnvConfig(envName: string): EnvConfig {
  const configPath = path.join(
    __dirname,
    `../../config/environments/${envName}.json`
  );
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as EnvConfig;
}

const app = new App();
const envName = app.node.tryGetContext('env') || getEnv();
const cfg = loadEnvConfig(envName);

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || cfg.awsAccount,
  region: process.env.CDK_DEFAULT_REGION || cfg.awsRegion,
};

// Shared Infrastructure Layer
const network = new NetworkStack(
  app,
  `${cfg.componentName}-Network-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    private: cfg.private,
  }
);

const iam = new IamStack(app, `${cfg.componentName}-IAM-${envName}`, {
  env,
  environmentName: envName,
  componentName: cfg.componentName,
});

const storage = new StorageStack(
  app,
  `${cfg.componentName}-Storage-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
  }
);

storage.codeBucket.grantRead(iam.pipelineRole);
storage.rawDataBucket.grantReadWrite(iam.pipelineRole);
storage.processedDataBucket.grantReadWrite(iam.pipelineRole);
storage.rawDataBucket.grantReadWrite(iam.sagemakerJobRole);
storage.processedDataBucket.grantReadWrite(iam.sagemakerJobRole);
storage.kmsKey.grantEncryptDecrypt(iam.sagemakerJobRole);
storage.kmsKey.grantEncryptDecrypt(iam.pipelineRole);
storage.kmsKey.grantEncryptDecrypt(iam.sagemakerExecutionRole);

const glue = new GlueStack(app, `${cfg.componentName}-Glue-${envName}`, {
  env,
  environmentName: envName,
  componentName: cfg.componentName,
});
glue.addDependency(storage);

const lakeFormation = new LakeFormationStack(
  app,
  `${cfg.componentName}-LakeFormation-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    rawDataBucket: storage.rawDataBucket,
    processedDataBucket: storage.processedDataBucket,
    dataLakeAdmins: [iam.pipelineRole],
    pipelineRole: iam.pipelineRole,
    sagemakerExecutionRole: iam.sagemakerExecutionRole,
    sagemakerJobRole: iam.sagemakerJobRole,
    rawDatabase: glue.rawDatabase,
    rawDatabaseName: glue.rawDatabaseName,
    processedDatabase: glue.processedDatabase,
    processedDatabaseName: glue.processedDatabaseName,
  }
);
lakeFormation.addDependency(storage);
lakeFormation.addDependency(iam);
lakeFormation.addDependency(glue);

const codeDeployment = new CodeDeploymentStack(
  app,
  `${cfg.componentName}-CodeDeployment-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    codeBucket: storage.codeBucket,
  }
);
codeDeployment.addDependency(storage);

const sagemakerStudio = new SagemakerStudioStack(
  app,
  `${cfg.componentName}-SagemakerStudio-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    vpc: network.vpc,
    securityGroup: network.sagemakerStudioSg,
    dataBucket: storage.rawDataBucket,
    dataKey: storage.kmsKey,
    executionRole: iam.sagemakerExecutionRole,
    private: cfg.private,
  }
);
sagemakerStudio.addDependency(network);
sagemakerStudio.addDependency(iam);
sagemakerStudio.addDependency(storage);

new UserProfileStack(app, `${cfg.componentName}-UserProfile-${envName}`, {
  env,
  environmentName: envName,
  componentName: cfg.componentName,
  studioDomain: sagemakerStudio.domain,
  securityGroup: network.sagemakerStudioSg,
});

// Experiment Bucketing Pipeline
// Uses SageMaker pipelines for preprocessing, training, and inference
const experimentPipeline = new ExperimentPipelineStack(
  app,
  `${cfg.componentName}-ExperimentPipeline-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    vpc: network.vpc,
    securityGroup: network.sagemakerStudioSg,
    rawDataBucket: storage.rawDataBucket,
    processedDataBucket: storage.processedDataBucket,
    codeBucket: storage.codeBucket,
    dataKey: storage.kmsKey,
    pipelineRole: iam.pipelineRole,
  }
);
experimentPipeline.addDependency(lakeFormation);
experimentPipeline.addDependency(codeDeployment);

// ML Experiment Recommender Pipeline
// Uses Glue ETL, SageMaker endpoint, and API Gateway for recommendations
const recommenderPipeline = new RecommenderPipelineStack(
  app,
  `${cfg.componentName}-RecommenderPipeline-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    processedDataBucket: storage.processedDataBucket,
    sagemakerExecutionRole: iam.sagemakerExecutionRole,
    lambdaExecutionRole: iam.pipelineRole,
    glueRole: iam.pipelineRole,
    databaseName: glue.processedDatabaseName,
  }
);
recommenderPipeline.addDependency(lakeFormation);
recommenderPipeline.addDependency(codeDeployment);
