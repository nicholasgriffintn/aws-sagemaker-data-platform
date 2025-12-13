import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Role } from "aws-cdk-lib/aws-iam";
import { CfnEndpoint, CfnEndpointConfig, CfnModel } from "aws-cdk-lib/aws-sagemaker";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from 'constructs';

import { EndpointMonitoring } from './monitoring';
import { EndpointMonitoringProps } from '../../../types';
import { getScriptDirectory, getScriptFilename } from '../utils/paths';

export interface EndpointProps {
  componentName: string;
  environmentName: string;
  processedDataBucket: Bucket;
  codeBucket: Bucket;
  pipelineName: string;
  pipelineRole: Role;
  vpc: Vpc;
  securityGroup: SecurityGroup;
  dataCapturePrefix?: string;
  modelArtifactsPath?: string;
  sagemakerImageUri: string;
  modelInterfaceScript?: string;
  kmsKeyId: string;
  primaryInstanceType: string;
  monitoring?: Omit<
    EndpointMonitoringProps,
    'endpointName' | 'componentName' | 'environmentName'
  >;
  useServerless?: boolean;
  serverlessMemorySizeMb?: number;
  serverlessMaxConcurrency?: number;
  skipInitialModel?: boolean;
}

export interface EndpointResources {
  model?: CfnModel;
  endpointConfig?: CfnEndpointConfig;
  endpoint?: CfnEndpoint;
  alertsTopic: Topic;
}

/**
 * Construct for creating a SageMaker endpoint.
 *
 * Adds:
 * - Model
 * - Endpoint Config
 * - Endpoint
 * - Monitoring
 */
export class Endpoint extends Construct {
  public readonly resources: EndpointResources;

  constructor(scope: Construct, id: string, props: EndpointProps) {
    super(scope, id);

    const skipInitialModel = props.skipInitialModel ?? false;
    const endpointName = `${props.componentName}-${props.environmentName}-${props.pipelineName}-endpoint`;

    let model: CfnModel | undefined;
    let endpointConfig: CfnEndpointConfig | undefined;
    let endpoint: CfnEndpoint | undefined;

    if (!skipInitialModel) {
      const modelDataUrl =
        props.modelArtifactsPath ??
        `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/models/model.tar.gz`;

      const inferenceScript = props.modelInterfaceScript ?? 'inference.py';
      const scriptDir = inferenceScript.includes('/')
        ? getScriptDirectory(inferenceScript)
        : '';
      const scriptFilename = inferenceScript.includes('/')
        ? getScriptFilename(inferenceScript)
        : inferenceScript;
      const submitDirectory = scriptDir
        ? `s3://${props.codeBucket.bucketName}/${scriptDir}/`
        : `s3://${props.codeBucket.bucketName}/`;

      model = new CfnModel(this, 'Model', {
        modelName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-model`,
        executionRoleArn: props.pipelineRole.roleArn,
        primaryContainer: {
          image: props.sagemakerImageUri,
          modelDataUrl,
          environment: {
            SAGEMAKER_PROGRAM: scriptFilename,
            SAGEMAKER_SUBMIT_DIRECTORY: submitDirectory,
          },
        },
        ...(props.useServerless
          ? {}
          : {
              vpcConfig: {
                securityGroupIds: [props.securityGroup.securityGroupId],
                subnets: props.vpc.privateSubnets.map(
                  (subnet) => subnet.subnetId
                ),
              },
            }),
      });

      const dataCapturePrefix =
        props.dataCapturePrefix ??
        `${props.pipelineName}-pipeline/data-capture/`;

      const modelName =
        model.modelName ||
        `${props.componentName}-${props.environmentName}-${props.pipelineName}-model`;

      const productionVariants = props.useServerless
        ? [
            {
              modelName,
              variantName: 'primary',
              serverlessConfig: {
                memorySizeInMb: props.serverlessMemorySizeMb ?? 2048,
                maxConcurrency: props.serverlessMaxConcurrency ?? 5,
              },
            },
          ]
        : [
            {
              modelName,
              variantName: 'primary',
              initialInstanceCount: 1,
              instanceType: props.primaryInstanceType,
              initialVariantWeight: 1,
            },
          ];

      endpointConfig = new CfnEndpointConfig(this, 'EndpointConfig', {
        endpointConfigName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-endpoint-config`,
        productionVariants,
        kmsKeyId: props.kmsKeyId,
        ...(props.useServerless
          ? {}
          : {
              dataCaptureConfig: {
                enableCapture: true,
                initialSamplingPercentage: 100,
                destinationS3Uri: `s3://${props.processedDataBucket.bucketName}/${dataCapturePrefix}`,
                kmsKeyId: props.kmsKeyId,
                captureOptions: [
                  { captureMode: 'Input' },
                  { captureMode: 'Output' },
                ],
                captureContentTypeHeader: {
                  jsonContentTypes: ['application/json'],
                  csvContentTypes: ['text/csv'],
                },
              },
            }),
      });

      endpointConfig.addDependency(model);

      endpoint = new CfnEndpoint(this, 'Endpoint', {
        endpointName,
        endpointConfigName:
          endpointConfig.endpointConfigName ??
          `${props.componentName}-${props.environmentName}-${props.pipelineName}-endpoint-config`,
      });
      endpoint.addDependency(endpointConfig);
    }

    const monitoring = new EndpointMonitoring(this, 'EndpointMonitoring', {
      componentName: props.componentName,
      environmentName: props.environmentName,
      endpointName,
      ...(props.monitoring ?? {}),
      pipelineName: props.pipelineName,
      useServerless: props.useServerless,
    });

    this.resources = {
      model,
      endpointConfig,
      endpoint,
      alertsTopic: monitoring.alertsTopic,
    };
  }
}
