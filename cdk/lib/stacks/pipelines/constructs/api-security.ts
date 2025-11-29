import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface ApiSecurityProps {
  componentName: string;
  environmentName: string;
  api: apigw.RestApi;
  apiName: string;
  rateLimit?: number;
  burstLimit?: number;
  quotaLimit?: number;
  allowedOrigins?: string[];
}

/**
 * Construct for API Gateway security enhancements.
 *
 * Adds:
 * - API Key for authentication
 * - Usage Plan with throttling
 * - CORS configuration
 */
export class ApiSecurity extends Construct {
  public readonly apiKey: apigw.ApiKey;
  public readonly usagePlan: apigw.UsagePlan;

  constructor(scope: Construct, id: string, props: ApiSecurityProps) {
    super(scope, id);

    this.apiKey = new apigw.ApiKey(this, 'ApiKey', {
      apiKeyName: `${props.componentName}-${props.environmentName}-${props.apiName}-key`,
      description: `API key for ${props.apiName} API`,
      enabled: true,
    });

    this.usagePlan = new apigw.UsagePlan(this, 'UsagePlan', {
      name: `${props.componentName}-${props.environmentName}-${props.apiName}-usage-plan`,
      description: `Usage plan for ${props.apiName} API`,
      throttle: {
        rateLimit: props.rateLimit ?? 100,
        burstLimit: props.burstLimit ?? 200,
      },
      quota: {
        limit: props.quotaLimit ?? 10000,
        period: apigw.Period.DAY,
      },
      apiStages: [
        {
          api: props.api,
          stage: props.api.deploymentStage,
        },
      ],
    });

    this.usagePlan.addApiKey(this.apiKey);

    new CfnOutput(this, `${props.apiName}ApiKeyId`, {
      value: this.apiKey.keyId,
      description: `API Key ID for ${props.apiName}. Retrieve value with: aws apigateway get-api-key --api-key <id> --include-value`,
    });
  }
}

/**
 * Helper function to create CORS-enabled REST API.
 * Use this when creating new APIs that need CORS support.
 */
export function createCorsEnabledApi(
  scope: Construct,
  id: string,
  props: {
    restApiName: string;
    description: string;
    allowedOrigins?: string[];
    allowedMethods?: string[];
    allowedHeaders?: string[];
  }
): apigw.RestApi {
  const allowedOrigins = props.allowedOrigins ?? ['*'];
  const allowedMethods = props.allowedMethods ?? [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'OPTIONS',
  ];
  const allowedHeaders = props.allowedHeaders ?? [
    'Content-Type',
    'X-Amz-Date',
    'Authorization',
    'X-Api-Key',
    'X-Amz-Security-Token',
  ];

  return new apigw.RestApi(scope, id, {
    restApiName: props.restApiName,
    description: props.description,
    defaultCorsPreflightOptions: {
      allowOrigins: allowedOrigins,
      allowMethods: allowedMethods,
      allowHeaders: allowedHeaders,
      allowCredentials: true,
      maxAge: Duration.hours(1),
    },
    deployOptions: {
      stageName: 'prod',
      throttlingRateLimit: 100,
      throttlingBurstLimit: 200,
      loggingLevel: apigw.MethodLoggingLevel.INFO,
      dataTraceEnabled: true,
      metricsEnabled: true,
    },
  });
}

/**
 * Helper function to add method with API key requirement.
 * Use this when creating new methods that require API key authentication.
 */
export function addSecureMethod(
  resource: apigw.Resource,
  httpMethod: string,
  integration: apigw.Integration,
  options?: apigw.MethodOptions
): apigw.Method {
  return resource.addMethod(httpMethod, integration, {
    ...options,
    apiKeyRequired: true,
  });
}
