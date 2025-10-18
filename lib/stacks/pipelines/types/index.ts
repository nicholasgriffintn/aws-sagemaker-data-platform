import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';

export interface PipelineScriptLocations {
  preprocessing: string;
  training: string;
  evaluation: string;
  inference: string;
}

export interface PipelineParameterOverrides {
  inputDataUrl?: string;
  modelApprovalStatus?: string;
  processingInstanceType?: string;
  trainingInstanceType?: string;
  modelType?: string;
  nEstimators?: string;
  maxDepth?: string;
}

export interface SageMakerPipelineProps {
  componentName: string;
  environmentName: string;
  rawDataBucket: Bucket;
  processedDataBucket: Bucket;
  codeBucket: Bucket;
  pipelineRole: Role;
  pipelineName: string;
  vpc: Vpc;
  securityGroup: SecurityGroup;
  pipelineNameSuffix?: string;
  sagemakerImageUri: string;
  primaryInstanceType: string;
  secondaryInstanceType: string;
  scriptLocations?: Partial<PipelineScriptLocations>;
  parameterOverrides?: PipelineParameterOverrides;
}
