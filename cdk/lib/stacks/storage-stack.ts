import { CfnOutput, PhysicalName, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Key } from "aws-cdk-lib/aws-kms";
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from "aws-cdk-lib/aws-s3";


export interface StorageStackProps extends StackProps {
	environmentName: string;
	componentName: string;
}

export class StorageStack extends Stack {
	public kmsKey: Key;
  public logBucket: Bucket;
  public rawDataBucket: Bucket;
  public processedDataBucket: Bucket;
  public codeBucket: Bucket;

	constructor(scope: Construct, id: string, props: StorageStackProps) {
		super(scope, id, props);

		this.kmsKey = new Key(this, `${props.componentName}-kms-key`, {
			alias: `${props.componentName}-${props.environmentName}/sagemaker`,
			description: 'KMS key for the storage stack',
			removalPolicy: RemovalPolicy.DESTROY,
		});

		this.logBucket = new Bucket(this, `${props.componentName}-log-bucket`, {
			bucketName: `${props.componentName}-${props.environmentName}-log-bucket`,
			blockPublicAccess:BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.KMS,
			encryptionKey: this.kmsKey,
			enforceSSL: true,
			autoDeleteObjects: true,
			objectOwnership: ObjectOwnership.OBJECT_WRITER,
		});

		this.rawDataBucket = new Bucket(this, `${props.componentName}-raw-data-bucket`, {
			bucketName: `${props.componentName}-${props.environmentName}-raw-data-bucket`,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.KMS,
			encryptionKey: this.kmsKey,
			enforceSSL: true,
			serverAccessLogsBucket: this.logBucket,
			serverAccessLogsPrefix: `raw-data-bucket-access-logs/`,
			autoDeleteObjects: true,
			objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
		});

		this.processedDataBucket = new Bucket(this, `${props.componentName}-processed-data-bucket`, {
			bucketName: `${props.componentName}-${props.environmentName}-processed-data-bucket`,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.KMS,
			encryptionKey: this.kmsKey,
			enforceSSL: true,
			serverAccessLogsBucket: this.logBucket,
			serverAccessLogsPrefix: `processed-data-bucket-access-logs/`,
			autoDeleteObjects: true,
			objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
		});

		this.codeBucket = new Bucket(this, `${props.componentName}-code-bucket`, {
			bucketName: `${props.componentName}-${props.environmentName}-code-bucket`,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.DESTROY,
			encryption: BucketEncryption.KMS,
			encryptionKey: this.kmsKey,
			enforceSSL: true,
			serverAccessLogsBucket: this.logBucket,
			serverAccessLogsPrefix: `code-bucket-access-logs/`,
			autoDeleteObjects: true,
			objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
			versioned: true,
		});

		new CfnOutput(this, 'kms_key_arn', {
			value: this.kmsKey.keyArn,
			description: 'The ARN of the KMS key',
		});

		new CfnOutput(this, 'log_bucket_name', {
			value: this.logBucket.bucketName,
			description: 'The name of the log bucket',
		});

		new CfnOutput(this, 'raw_data_bucket_name', {
			value: this.rawDataBucket.bucketName,
			description: 'The name of the raw data bucket',
		});

		new CfnOutput(this, 'processed_data_bucket_name', {
			value: this.processedDataBucket.bucketName,
			description: 'The name of the processed data bucket',
		});

		new CfnOutput(this, 'code_bucket_name', {
			value: this.codeBucket.bucketName,
			description: 'The name of the code bucket',
		});
	}
}
