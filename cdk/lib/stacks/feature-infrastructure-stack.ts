import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  AttributeType,
  BillingMode,
  Table,
  TableEncryption,
} from 'aws-cdk-lib/aws-dynamodb';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFeatureGroup } from 'aws-cdk-lib/aws-sagemaker';
import { Bucket } from 'aws-cdk-lib/aws-s3';

export interface FeatureInfrastructureStackProps extends StackProps {
  environmentName: string;
  componentName: string;
  kmsKey: Key;
  offlineStoreBucket: Bucket;
  sagemakerExecutionRole: Role;
}

/**
 * Feature Infrastructure Stack
 *
 * Creates infrastructure for user feature storage:
 * - DynamoDB table for real-time user features
 * - SageMaker Feature Store for ML-optimized features
 */
export class FeatureInfrastructureStack extends Stack {
  public readonly userFeaturesTable: Table;
  public readonly featureGroup: CfnFeatureGroup;
  public readonly featureGroupName: string;

  constructor(
    scope: Construct,
    id: string,
    props: FeatureInfrastructureStackProps
  ) {
    super(scope, id, props);

    const tableName = `${props.componentName}-${props.environmentName}-user-features`;
    this.featureGroupName = `${props.componentName}-${props.environmentName}-user-bucketing-features`;

    this.userFeaturesTable = new Table(this, 'UserFeaturesTable', {
      tableName,
      partitionKey: {
        name: 'user_id',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    this.featureGroup = new CfnFeatureGroup(this, 'UserBucketingFeatureGroup', {
      featureGroupName: this.featureGroupName,
      recordIdentifierFeatureName: 'user_id',
      eventTimeFeatureName: 'event_time',
      featureDefinitions: [
        { featureName: 'user_id', featureType: 'String' },
        { featureName: 'event_time', featureType: 'String' },
        { featureName: 'age', featureType: 'Integral' },
        { featureName: 'gender', featureType: 'String' },
        { featureName: 'location', featureType: 'String' },
        { featureName: 'session_count', featureType: 'Integral' },
        { featureName: 'avg_session_duration', featureType: 'Fractional' },
        { featureName: 'page_views', featureType: 'Integral' },
        { featureName: 'purchase_history', featureType: 'Integral' },
        { featureName: 'total_spent', featureType: 'Fractional' },
        { featureName: 'engagement_score', featureType: 'Fractional' },
        {
          featureName: 'historical_conversion_rate',
          featureType: 'Fractional',
        },
      ],
      roleArn: props.sagemakerExecutionRole.roleArn,
      onlineStoreConfig: {
        enableOnlineStore: true,
        securityConfig: {
          kmsKeyId: props.kmsKey.keyId,
        },
      },
      offlineStoreConfig: {
        s3StorageConfig: {
          s3Uri: `s3://${props.offlineStoreBucket.bucketName}/feature-store/${this.featureGroupName}/`,
          kmsKeyId: props.kmsKey.keyId,
        },
        disableGlueTableCreation: false,
      },
      description: 'User features for bucketing and experiment assignment',
    });


    new CfnOutput(this, 'UserFeaturesTableName', {
      value: this.userFeaturesTable.tableName,
      description: 'DynamoDB table name for user features',
    });

    new CfnOutput(this, 'UserFeaturesTableArn', {
      value: this.userFeaturesTable.tableArn,
      description: 'DynamoDB table ARN for user features',
    });

    new CfnOutput(this, 'FeatureGroupName', {
      value: this.featureGroupName,
      description: 'SageMaker Feature Group name',
    });
  }
}
