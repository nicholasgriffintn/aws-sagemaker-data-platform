import { aws_s3 as s3, RemovalPolicy, Stack, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DataLakeStackProps {
	environmentName: string;
}

export class DataLakeStack extends Stack {
	public readonly rawBucket: s3.Bucket;
	public readonly curatedBucket: s3.Bucket;
	public readonly projectBucket: s3.Bucket;

	constructor(scope: Construct, id: string, props: DataLakeStackProps) {
		super(scope, id);

		this.rawBucket = new s3.Bucket(this, 'RawBucket', {
			versioned: true,
			encryption: s3.BucketEncryption.S3_MANAGED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: false,
			removalPolicy: RemovalPolicy.RETAIN,
		});

		this.curatedBucket = new s3.Bucket(this, 'CuratedBucket', {
			versioned: true,
			encryption: s3.BucketEncryption.S3_MANAGED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: false,
			removalPolicy: RemovalPolicy.RETAIN,
		});

		this.projectBucket = new s3.Bucket(this, 'ProjectArtifactsBucket', {
			versioned: true,
			encryption: s3.BucketEncryption.S3_MANAGED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			enforceSSL: true,
			autoDeleteObjects: false,
			removalPolicy: RemovalPolicy.RETAIN,
		});

		new CfnOutput(this, 'RawBucketName', {
			value: this.rawBucket.bucketName,
			description: 'Name of the raw data S3 bucket',
			exportName: `${props.environmentName}-RawBucketName`,
		});

		new CfnOutput(this, 'CuratedBucketName', {
			value: this.curatedBucket.bucketName,
			description: 'Name of the curated data S3 bucket',
			exportName: `${props.environmentName}-CuratedBucketName`,
		});

		new CfnOutput(this, 'ProjectBucketName', {
			value: this.projectBucket.bucketName,
			description: 'Name of the project artifacts S3 bucket',
			exportName: `${props.environmentName}-ProjectBucketName`,
		});
	}
}
