import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Role } from "aws-cdk-lib/aws-iam";
import { CfnEndpoint, CfnEndpointConfig, CfnModel } from "aws-cdk-lib/aws-sagemaker";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from 'constructs';

import { EndpointMonitoring } from './monitoring';
import { EndpointMonitoringProps } from '../types/monitoring';

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
}

export interface EndpointResources {
  model: CfnModel;
  endpointConfig: CfnEndpointConfig;
  endpoint: CfnEndpoint;
  alertsTopic: Topic;
}

export class Endpoint extends Construct {
  public readonly resources: EndpointResources;

  constructor(scope: Construct, id: string, props: EndpointProps) {
    super(scope, id);

    const modelDataUrl =
      props.modelArtifactsPath ??
      `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/models/model.tar.gz`;

    const model = new CfnModel(this, 'Model', {
      modelName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-model`,
      executionRoleArn: props.pipelineRole.roleArn,
      primaryContainer: {
        image: props.sagemakerImageUri,
        modelDataUrl,
        environment: {
          SAGEMAKER_PROGRAM: props.modelInterfaceScript ?? 'inference.py',
          SAGEMAKER_SUBMIT_DIRECTORY: `s3://${props.codeBucket.bucketName}/`,
        },
      },
      vpcConfig: {
        securityGroupIds: [props.securityGroup.securityGroupId],
        subnets: props.vpc.privateSubnets.map((subnet) => subnet.subnetId),
      },
    });

    const dataCapturePrefix =
      props.dataCapturePrefix ?? `${props.pipelineName}-pipeline/data-capture/`;

    const endpointConfig = new CfnEndpointConfig(this, 'EndpointConfig', {
      endpointConfigName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-endpoint-config`,
      productionVariants: [
        {
          modelName:
            model.modelName ||
            `${props.componentName}-${props.environmentName}-${props.pipelineName}-model`,
          variantName: 'primary',
          initialInstanceCount: 1,
          instanceType: props.primaryInstanceType,
          initialVariantWeight: 1,
        },
      ],
      kmsKeyId: props.kmsKeyId,
      dataCaptureConfig: {
        enableCapture: true,
        initialSamplingPercentage: 100,
        destinationS3Uri: `s3://${props.processedDataBucket.bucketName}/${dataCapturePrefix}`,
        kmsKeyId: props.kmsKeyId,
        captureOptions: [{ captureMode: 'Input' }, { captureMode: 'Output' }],
        captureContentTypeHeader: {
          jsonContentTypes: ['application/json'],
          csvContentTypes: ['text/csv'],
        },
      },
    });

    endpointConfig.addDependency(model);

    const endpoint = new CfnEndpoint(this, 'Endpoint', {
      endpointName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-endpoint`,
      endpointConfigName:
        endpointConfig.endpointConfigName ??
        `${props.componentName}-${props.environmentName}-${props.pipelineName}-endpoint-config`,
    });
    endpoint.addDependency(endpointConfig);

    const monitoring = new EndpointMonitoring(this, 'EndpointMonitoring', {
      componentName: props.componentName,
      environmentName: props.environmentName,
      endpointName:
        endpoint.attrEndpointName ??
        `${props.componentName}-${props.environmentName}-${props.pipelineName}-endpoint`,
      ...(props.monitoring ?? {}),
      pipelineName: props.pipelineName,
    });

    this.resources = {
      model,
      endpointConfig,
      endpoint,
      alertsTopic: monitoring.alertsTopic,
    };
  }
}
