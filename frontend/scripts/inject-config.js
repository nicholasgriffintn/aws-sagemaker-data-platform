#!/usr/bin/env node

/**
 * Config Injection Script
 *
 * This script injects API endpoint URLs into the frontend configuration
 * by reading CloudFormation outputs and updating the endpoints.ts file.
 *
 * Usage:
 *   node scripts/inject-config.js [environment]
 *
 * Or with explicit URLs:
 *   BUCKETING_API_URL=https://... RECOMMENDER_API_URL=https://... node scripts/inject-config.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const environment = process.argv[2] || 'dev';
const componentName = 'aws-ml-platform';

console.log(`\n📦 Injecting configuration for environment: ${environment}\n`);

let bucketingApiUrl = process.env.BUCKETING_API_URL;
let recommenderApiUrl = process.env.RECOMMENDER_API_URL;
let bucketingApiKey = process.env.BUCKETING_API_KEY;
let recommenderApiKey = process.env.RECOMMENDER_API_KEY;
let region = process.env.AWS_REGION || 'eu-west-1';

if (!bucketingApiUrl || !recommenderApiUrl) {
  console.log('🔍 Fetching API URLs from CloudFormation outputs...');

  try {
    const bucketingStackName = `${componentName}-ExperimentPipeline-${environment}`;
    const bucketingOutput = execSync(
      `aws cloudformation describe-stacks --stack-name ${bucketingStackName} --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text`,
      { encoding: 'utf-8' }
    ).trim();

    if (bucketingOutput && !bucketingOutput.includes('error')) {
      bucketingApiUrl = bucketingOutput;
      console.log(`  ✓ Bucketing API: ${bucketingApiUrl}`);
    }
  } catch (err) {
    console.log('  ⚠ Could not fetch bucketing API URL from CloudFormation');
  }

  try {
    const recommenderStackName = `${componentName}-RecommenderPipeline-${environment}`;
    const recommenderOutput = execSync(
      `aws cloudformation describe-stacks --stack-name ${recommenderStackName} --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text`,
      { encoding: 'utf-8' }
    ).trim();

    if (recommenderOutput && !recommenderOutput.includes('error')) {
      recommenderApiUrl = recommenderOutput;
      console.log(`  ✓ Recommender API: ${recommenderApiUrl}`);
    }
  } catch (err) {
    console.log('  ⚠ Could not fetch recommender API URL from CloudFormation');
  }
}

if (!bucketingApiKey || !recommenderApiKey) {
  console.log('🔑 Fetching API keys...');

  try {
    const bucketingStackName = `${componentName}-ExperimentPipeline-${environment}`;
    const keyIdOutput = execSync(
      `aws cloudformation describe-stacks --stack-name ${bucketingStackName} --query "Stacks[0].Outputs[?contains(OutputKey, 'ApiKeyId')].OutputValue" --output text`,
      { encoding: 'utf-8' }
    ).trim();

    if (
      keyIdOutput &&
      !keyIdOutput.includes('error') &&
      keyIdOutput !== 'None'
    ) {
      const keyValue = execSync(
        `aws apigateway get-api-key --api-key ${keyIdOutput} --include-value --query "value" --output text`,
        { encoding: 'utf-8' }
      ).trim();
      if (keyValue && keyValue !== 'None') {
        bucketingApiKey = keyValue;
        console.log(
          `  ✓ Bucketing API Key: ${bucketingApiKey.substring(0, 8)}...`
        );
      }
    }
  } catch (err) {
    console.log('  ⚠ Could not fetch bucketing API key');
  }

  try {
    const recommenderStackName = `${componentName}-RecommenderPipeline-${environment}`;
    const keyIdOutput = execSync(
      `aws cloudformation describe-stacks --stack-name ${recommenderStackName} --query "Stacks[0].Outputs[?contains(OutputKey, 'ApiKeyId')].OutputValue" --output text`,
      { encoding: 'utf-8' }
    ).trim();

    if (
      keyIdOutput &&
      !keyIdOutput.includes('error') &&
      keyIdOutput !== 'None'
    ) {
      const keyValue = execSync(
        `aws apigateway get-api-key --api-key ${keyIdOutput} --include-value --query "value" --output text`,
        { encoding: 'utf-8' }
      ).trim();
      if (keyValue && keyValue !== 'None') {
        recommenderApiKey = keyValue;
        console.log(
          `  ✓ Recommender API Key: ${recommenderApiKey.substring(0, 8)}...`
        );
      }
    }
  } catch (err) {
    console.log('  ⚠ Could not fetch recommender API key');
  }
}

if (!bucketingApiUrl) {
  bucketingApiUrl = '__BUCKETING_API_URL__';
  console.log('  ℹ Using placeholder for bucketing API URL');
}

if (!recommenderApiUrl) {
  recommenderApiUrl = '__RECOMMENDER_API_URL__';
  console.log('  ℹ Using placeholder for recommender API URL');
}

if (!bucketingApiKey) {
  bucketingApiKey = '__BUCKETING_API_KEY__';
  console.log('  ℹ Using placeholder for bucketing API key');
}

if (!recommenderApiKey) {
  recommenderApiKey = '__RECOMMENDER_API_KEY__';
  console.log('  ℹ Using placeholder for recommender API key');
}

const configPath = path.join(__dirname, '../src/config/endpoints.ts');
const configContent = `export interface ApiConfig {
  bucketingApiUrl: string;
  recommenderApiUrl: string;
  bucketingApiKey: string;
  recommenderApiKey: string;
  environment: string;
  region: string;
}

export const apiConfig: ApiConfig = {
  bucketingApiUrl: '${bucketingApiUrl}',
  recommenderApiUrl: '${recommenderApiUrl}',
  bucketingApiKey: '${bucketingApiKey}',
  recommenderApiKey: '${recommenderApiKey}',
  environment: '${environment}',
  region: '${region}',
};

export function isConfigured(apiType?: 'bucketing' | 'recommender'): boolean {
  const bucketingReady = !apiConfig.bucketingApiUrl.startsWith('__');
  const recommenderReady = !apiConfig.recommenderApiUrl.startsWith('__');

  if (!apiType) {
    return bucketingReady && recommenderReady;
  }

  return apiType === 'bucketing' ? bucketingReady : recommenderReady;
}

export function getBucketingUrl(): string {
  return \`\${apiConfig.bucketingApiUrl}bucket\`;
}

export function getRecommenderUrl(): string {
  return \`\${apiConfig.recommenderApiUrl}recommend\`;
}

export function getBucketingApiKey(): string {
  return apiConfig.bucketingApiKey;
}

export function getRecommenderApiKey(): string {
  return apiConfig.recommenderApiKey;
}

export function getApiHeaders(apiType: 'bucketing' | 'recommender'): HeadersInit {
  const apiKey = apiType === 'bucketing' ? getBucketingApiKey() : getRecommenderApiKey();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (apiKey && !apiKey.startsWith('__')) {
    headers['x-api-key'] = apiKey;
  }
  return headers;
}
`;

fs.writeFileSync(configPath, configContent);
console.log(`\n✅ Configuration written to: ${configPath}\n`);
