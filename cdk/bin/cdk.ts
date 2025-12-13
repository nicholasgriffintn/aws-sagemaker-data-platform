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
import { FeatureInfrastructureStack } from '../lib/stacks/feature-infrastructure-stack';
import { ExperimentPipelineStack } from '../lib/stacks/pipelines/experiment-pipeline-stack';
import { RecommenderPipelineStack } from '../lib/stacks/pipelines/recommender-pipeline-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { DataPipelineStack } from '../lib/stacks/data-pipeline-stack';
import { grantPipelineStoragePermissions } from '../lib/utils';

interface EndpointConfig {
  deployEndpoint?: boolean;
  useServerlessEndpoint?: boolean;
  serverlessMemorySizeMb?: number;
  serverlessMaxConcurrency?: number;
}

interface StackToggles {
  glue?: boolean;
  lakeFormation?: boolean;
  featureInfra?: boolean;
  dataPipelines?: boolean;
  sagemakerStudio?: boolean;
  userProfiles?: boolean;
  experimentPipeline?: boolean;
  recommenderPipeline?: boolean;
}

interface InstanceTypeConfig {
  primary?: string;
  secondary?: string;
  trainingPrimary?: string;
  trainingSecondary?: string;
  endpointPrimary?: string;
  endpointSecondary?: string;
}

interface EnvConfig {
  componentName: string;
  awsAccount: string;
  awsRegion: string;
  private: boolean;
  endpointConfig?: EndpointConfig;
  stacks?: StackToggles;
  instanceTypes?: InstanceTypeConfig;
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
const stackToggles = {
  glue: cfg.stacks?.glue ?? true,
  lakeFormation: cfg.stacks?.lakeFormation ?? true,
  featureInfra: cfg.stacks?.featureInfra ?? true,
  dataPipelines: cfg.stacks?.dataPipelines ?? true,
  sagemakerStudio: cfg.stacks?.sagemakerStudio ?? true,
  userProfiles: cfg.stacks?.userProfiles ?? true,
  experimentPipeline: cfg.stacks?.experimentPipeline ?? true,
  recommenderPipeline: cfg.stacks?.recommenderPipeline ?? true,
};

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || cfg.awsAccount,
  region: process.env.CDK_DEFAULT_REGION || cfg.awsRegion,
};

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

grantPipelineStoragePermissions(storage, iam);

const glue = stackToggles.glue
  ? new GlueStack(app, `${cfg.componentName}-Glue-${envName}`, {
      env,
      environmentName: envName,
      componentName: cfg.componentName,
      rawDataBucket: storage.rawDataBucket,
      processedDataBucket: storage.processedDataBucket,
      codeBucket: storage.codeBucket,
      kmsKey: storage.kmsKey,
    })
  : undefined;
if (glue) {
  glue.addDependency(storage);
}

const lakeFormation =
  stackToggles.lakeFormation && glue
    ? new LakeFormationStack(
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
          rawDatabase: glue!.rawDatabase,
          rawDatabaseName: glue!.rawDatabaseName,
          processedDatabase: glue!.processedDatabase,
          processedDatabaseName: glue!.processedDatabaseName,
        }
      )
    : undefined;
if (lakeFormation && glue) {
  lakeFormation.addDependency(storage);
  lakeFormation.addDependency(iam);
  lakeFormation.addDependency(glue);
}

const codeDeployment = new CodeDeploymentStack(
  app,
  `${cfg.componentName}-CodeDeployment-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    codeBucket: storage.codeBucket,
    processedDataBucket: storage.processedDataBucket,
  }
);
codeDeployment.addDependency(storage);

const sagemakerStudio = stackToggles.sagemakerStudio
  ? new SagemakerStudioStack(
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
    )
  : undefined;
if (sagemakerStudio) {
  sagemakerStudio.addDependency(network);
  sagemakerStudio.addDependency(iam);
  sagemakerStudio.addDependency(storage);
}

if (stackToggles.userProfiles && sagemakerStudio) {
  new UserProfileStack(app, `${cfg.componentName}-UserProfile-${envName}`, {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    studioDomain: sagemakerStudio.domain,
    securityGroup: network.sagemakerStudioSg,
  });
}

const featureInfra = stackToggles.featureInfra
  ? new FeatureInfrastructureStack(
      app,
      `${cfg.componentName}-FeatureInfra-${envName}`,
      {
        env,
        environmentName: envName,
        componentName: cfg.componentName,
        kmsKey: storage.kmsKey,
        offlineStoreBucket: storage.processedDataBucket,
        sagemakerExecutionRole: iam.sagemakerExecutionRole,
      }
    )
  : undefined;
if (featureInfra) {
  featureInfra.addDependency(storage);
  featureInfra.addDependency(iam);
}

const demoUserFeaturesTableName = `${cfg.componentName}-${envName}-demo-user-features`;
const demoFeatureGroupName = `${cfg.componentName}-${envName}-demo-feature-group`;

const experimentPipeline = stackToggles.experimentPipeline
  ? new ExperimentPipelineStack(
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
        lambdaExecutionRole: iam.lambdaExecutionRole,
        userFeaturesTableName:
          featureInfra?.userFeaturesTable.tableName ??
          demoUserFeaturesTableName,
        featureGroupName:
          featureInfra?.featureGroupName ?? demoFeatureGroupName,
        endpointConfig: cfg.endpointConfig,
        instanceTypes: cfg.instanceTypes,
      }
    )
  : undefined;
if (lakeFormation && experimentPipeline) {
  experimentPipeline.addDependency(lakeFormation);
}
if (experimentPipeline) {
  experimentPipeline.addDependency(codeDeployment);
}
if (featureInfra && experimentPipeline) {
  experimentPipeline.addDependency(featureInfra);
}

const recommenderPipeline = stackToggles.recommenderPipeline
  ? new RecommenderPipelineStack(
      app,
      `${cfg.componentName}-RecommenderPipeline-${envName}`,
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
        lambdaExecutionRole: iam.lambdaExecutionRole,
        endpointConfig: cfg.endpointConfig,
        instanceTypes: cfg.instanceTypes,
      }
    )
  : undefined;
if (lakeFormation && recommenderPipeline) {
  recommenderPipeline.addDependency(lakeFormation);
}
if (recommenderPipeline) {
  recommenderPipeline.addDependency(codeDeployment);
}
if (featureInfra && recommenderPipeline) {
  recommenderPipeline.addDependency(featureInfra);
}

const dataPipeline =
  stackToggles.dataPipelines && glue
    ? new DataPipelineStack(
        app,
        `${cfg.componentName}-DataPipeline-${envName}`,
        {
          env,
          environmentName: envName,
          componentName: cfg.componentName,
          rawDataBucket: storage.rawDataBucket,
          processedDataBucket: storage.processedDataBucket,
          bucketingEtlJobName: `${cfg.componentName}-${envName}-bucketing-etl`,
          experimentEtlJobName: `${cfg.componentName}-${envName}-experiment-etl`,
          bucketingPipelineName: `${cfg.componentName}-${envName}-bucketing-pipeline`,
          recommenderPipelineName: `${cfg.componentName}-${envName}-recommender-pipeline`,
        }
      )
    : undefined;
if (dataPipeline && glue) {
  dataPipeline.addDependency(glue);
  if (experimentPipeline) {
    dataPipeline.addDependency(experimentPipeline);
  }
  if (recommenderPipeline) {
    dataPipeline.addDependency(recommenderPipeline);
  }
}

const frontend = new FrontendStack(
  app,
  `${cfg.componentName}-Frontend-${envName}`,
  {
    env,
    environmentName: envName,
    componentName: cfg.componentName,
    bucketingApiUrl: experimentPipeline?.api.url || '',
    recommenderApiUrl: recommenderPipeline?.api.url || '',
  }
);
if (experimentPipeline) {
  frontend.addDependency(experimentPipeline);
}
if (recommenderPipeline) {
  frontend.addDependency(recommenderPipeline);
}
