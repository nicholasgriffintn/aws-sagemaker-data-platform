import { StackProps } from 'aws-cdk-lib';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket } from 'aws-cdk-lib/aws-s3';

export interface BaseStackProps extends StackProps {
  environmentName: string;
  componentName: string;
}

export interface VpcAwareProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
}

export interface StorageAwareProps {
  rawDataBucket: Bucket;
  processedDataBucket: Bucket;
  codeBucket: Bucket;
  dataKey: Key;
}

export interface RoleAwareProps {
  pipelineRole: Role;
  lambdaExecutionRole: Role;
}

export interface EndpointConfig {
  deployEndpoint?: boolean;
  useServerlessEndpoint?: boolean;
  serverlessMemorySizeMb?: number;
  serverlessMaxConcurrency?: number;
}

export interface PipelineStackProps
  extends BaseStackProps,
    VpcAwareProps,
    StorageAwareProps,
    RoleAwareProps {
  alertEmail?: string;
  enableApiSecurity?: boolean;
  enableScheduledRetraining?: boolean;
  retrainingSchedule?: string;
  enableModelAutoDeploy?: boolean;
  endpointConfig?: EndpointConfig;
}
