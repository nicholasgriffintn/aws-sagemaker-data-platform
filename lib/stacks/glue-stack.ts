import { Construct } from 'constructs';
import {
	CfnOutput,
	aws_glue as glue,
	aws_iam as iam,
	aws_s3 as s3,
	Stack
} from 'aws-cdk-lib';

export interface GlueStackProps {
	environmentName: string;
	rawBucket: s3.IBucket;
	curatedBucket: s3.IBucket;
	projectBucket: s3.IBucket;
}

export class GlueStack extends Stack {
	public readonly database: glue.CfnDatabase;
	public readonly glueRole: iam.Role;
	public readonly crawler: glue.CfnCrawler;

	constructor(scope: Construct, id: string, props: GlueStackProps) {
		super(scope, id);

		this.glueRole = new iam.Role(this, 'GlueServiceRole', {
			assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
			description: 'Service role for AWS Glue operations',
		});

		this.glueRole.addManagedPolicy(
			iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')
		);

		props.rawBucket.grantReadWrite(this.glueRole);
		props.curatedBucket.grantReadWrite(this.glueRole);
		props.projectBucket.grantReadWrite(this.glueRole);

		this.database = new glue.CfnDatabase(this, 'DataCatalogDatabase', {
			catalogId: this.account,
			databaseInput: {
				name: `${props.environmentName}-data-catalog`,
				description: `Data catalog database for ${props.environmentName} environment`,
			},
		});

		this.crawler = new glue.CfnCrawler(this, 'RawDataCrawler', {
			name: `${props.environmentName}-raw-data-crawler`,
			role: this.glueRole.roleArn,
			databaseName: this.database.ref,
			targets: {
				s3Targets: [
					{
						path: `s3://${props.rawBucket.bucketName}/`,
					},
				],
			},
			description: 'Crawler for raw data in the data lake',
			schemaChangePolicy: {
				updateBehavior: 'UPDATE_IN_DATABASE',
				deleteBehavior: 'LOG',
			},
			configuration: JSON.stringify({
				Version: 1.0,
				CrawlerOutput: {
					Partitions: { AddOrUpdateBehavior: 'InheritFromTable' },
					Tables: { AddOrUpdateBehavior: 'MergeNewColumns' }
				}
			}),
		});

		const etlJob = new glue.CfnJob(this, 'SampleETLJob', {
			name: `${props.environmentName}-sample-etl-job`,
			role: this.glueRole.roleArn,
			command: {
				name: 'glueetl',
				scriptLocation: `s3://${props.projectBucket.bucketName}/glue-scripts/sample-etl.py`,
				pythonVersion: '3',
			},
			defaultArguments: {
				'--enable-metrics': 'true',
				'--enable-spark-ui': 'true',
				'--spark-event-logs-path': `s3://${props.projectBucket.bucketName}/glue-logs/`,
				'--enable-job-insights': 'true',
				'--enable-observability-metrics': 'true',
				'--source-bucket': props.rawBucket.bucketName,
				'--target-bucket': props.curatedBucket.bucketName,
				'--database-name': this.database.ref,
			},
			description: 'Sample ETL job for data transformation',
			glueVersion: '4.0',
			maxCapacity: 2,
			timeout: 60,
		});

		new CfnOutput(this, 'GlueDatabase', {
			value: this.database.ref,
			description: 'Glue Data Catalog database name',
		});

		new CfnOutput(this, 'GlueCrawler', {
			value: this.crawler.ref,
			description: 'Glue crawler name for raw data',
		});

		new CfnOutput(this, 'GlueETLJob', {
			value: etlJob.ref,
			description: 'Sample Glue ETL job name',
		});
	}
}
