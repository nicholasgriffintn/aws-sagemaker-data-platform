import { aws_s3 as s3, RemovalPolicy, Stack } from 'aws-cdk-lib';
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
	}
}
