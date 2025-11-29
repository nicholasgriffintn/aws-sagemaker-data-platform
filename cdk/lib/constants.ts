export const INSTANCE_TYPES = {
  PRIMARY: 'ml.m5.large',
  SECONDARY: 'ml.m5.xlarge',
} as const;

export const S3_PREFIXES = {
  MODELS: 'models',
  DATA_CAPTURE: 'data-capture',
  PROCESSED: 'processed',
  EVALUATION: 'evaluation',
} as const;

export const LAMBDA_CONFIG = {
  RUNTIME_PYTHON: '3.12',
  DEFAULT_TIMEOUT_SECONDS: 30,
  DEFAULT_MEMORY_MB: 256,
} as const;

export const API_LIMITS = {
  DEFAULT_RATE_LIMIT: 100,
  DEFAULT_BURST_LIMIT: 200,
  DEFAULT_QUOTA_LIMIT: 10000,
} as const;

export const RETRAINING_SCHEDULE = {
  DEFAULT_CRON: 'cron(0 2 ? * SUN *)',
} as const;

export function getPipelinePrefix(pipelineName: string): string {
  return `${pipelineName}-pipeline`;
}

export function getResourceName(
  componentName: string,
  environmentName: string,
  resourceType: string
): string {
  return `${componentName}-${environmentName}-${resourceType}`;
}
