import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export interface GlueStackProps extends StackProps {
  environmentName: string;
  componentName: string;
  rawDataBucket: s3.IBucket;
  processedDataBucket: s3.IBucket;
  codeBucket: s3.IBucket;
  kmsKey: kms.IKey;
}

/**
 * Stack for creating Glue databases and ETL jobs for data processing.
 *
 * Creates:
 * - Raw Glue Database
 * - Processed Glue Database
 * - Glue ETL Role
 * - Bucketing Data Processing Job
 * - Experiment Data Processing Job
 */
export class GlueStack extends Stack {
  public readonly rawDatabase: glue.CfnDatabase;
  public readonly rawDatabaseName: string;
  public readonly processedDatabase: glue.CfnDatabase;
  public readonly processedDatabaseName: string;
  public readonly glueRole: iam.Role;
  public readonly bucketingEtlJob: glue.CfnJob;
  public readonly experimentEtlJob: glue.CfnJob;

  constructor(scope: Construct, id: string, props: GlueStackProps) {
    super(scope, id, props);

    const catalogId = this.account;

    this.rawDatabaseName = `${props.componentName}_${props.environmentName}_raw`;
    this.processedDatabaseName = `${props.componentName}_${props.environmentName}_processed`;

    this.rawDatabase = new glue.CfnDatabase(this, 'RawGlueDatabase', {
      catalogId,
      databaseInput: {
        name: this.rawDatabaseName,
        description: 'Raw dataset database for Lake Formation access control',
      },
    });

    this.processedDatabase = new glue.CfnDatabase(
      this,
      'ProcessedGlueDatabase',
      {
        catalogId,
        databaseInput: {
          name: this.processedDatabaseName,
          description:
            'Processed dataset database for Lake Formation access control',
        },
      }
    );

    this.glueRole = new iam.Role(this, 'GlueEtlRole', {
      roleName: `${props.componentName}-${props.environmentName}-glue-etl-role`,
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSGlueServiceRole'
        ),
      ],
    });

    props.rawDataBucket.grantRead(this.glueRole);
    props.processedDataBucket.grantReadWrite(this.glueRole);
    props.codeBucket.grantRead(this.glueRole);

    props.kmsKey.grantEncryptDecrypt(this.glueRole);

    this.glueRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'glue:GetDatabase',
          'glue:GetDatabases',
          'glue:GetTable',
          'glue:GetTables',
          'glue:GetPartition',
          'glue:GetPartitions',
          'glue:BatchGetPartition',
          'glue:CreateTable',
          'glue:UpdateTable',
          'glue:DeleteTable',
          'glue:BatchCreatePartition',
          'glue:BatchDeletePartition',
        ],
        resources: [
          `arn:aws:glue:${this.region}:${this.account}:catalog`,
          `arn:aws:glue:${this.region}:${this.account}:database/${this.rawDatabaseName}`,
          `arn:aws:glue:${this.region}:${this.account}:database/${this.processedDatabaseName}`,
          `arn:aws:glue:${this.region}:${this.account}:table/${this.rawDatabaseName}/*`,
          `arn:aws:glue:${this.region}:${this.account}:table/${this.processedDatabaseName}/*`,
        ],
      })
    );

    this.glueRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws-glue/*`,
        ],
      })
    );

    new s3deploy.BucketDeployment(this, 'GlueScriptsDeployment', {
      sources: [s3deploy.Source.asset('glue/jobs')],
      destinationBucket: props.codeBucket,
      destinationKeyPrefix: 'glue-scripts/',
    });

    this.bucketingEtlJob = new glue.CfnJob(this, 'BucketingEtlJob', {
      name: `${props.componentName}-${props.environmentName}-bucketing-etl`,
      role: this.glueRole.roleArn,
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: `s3://${props.codeBucket.bucketName}/glue-scripts/process_bucketing_data.py`,
      },
      defaultArguments: {
        '--raw_bucket': props.rawDataBucket.bucketName,
        '--processed_bucket': props.processedDataBucket.bucketName,
        '--raw_database': this.rawDatabaseName,
        '--processed_database': this.processedDatabaseName,
        '--enable-metrics': 'true',
        '--enable-continuous-cloudwatch-log': 'true',
        '--enable-spark-ui': 'true',
        '--spark-event-logs-path': `s3://${props.processedDataBucket.bucketName}/spark-logs/bucketing/`,
        '--job-bookmark-option': 'job-bookmark-enable',
        '--TempDir': `s3://${props.processedDataBucket.bucketName}/glue-temp/`,
      },
      glueVersion: '4.0',
      workerType: 'G.1X',
      numberOfWorkers: 2,
      timeout: 60,
      maxRetries: 1,
      executionProperty: {
        maxConcurrentRuns: 1,
      },
    });

    this.experimentEtlJob = new glue.CfnJob(this, 'ExperimentEtlJob', {
      name: `${props.componentName}-${props.environmentName}-experiment-etl`,
      role: this.glueRole.roleArn,
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: `s3://${props.codeBucket.bucketName}/glue-scripts/process_experiment_data.py`,
      },
      defaultArguments: {
        '--raw_bucket': props.rawDataBucket.bucketName,
        '--processed_bucket': props.processedDataBucket.bucketName,
        '--raw_database': this.rawDatabaseName,
        '--processed_database': this.processedDatabaseName,
        '--enable-metrics': 'true',
        '--enable-continuous-cloudwatch-log': 'true',
        '--enable-spark-ui': 'true',
        '--spark-event-logs-path': `s3://${props.processedDataBucket.bucketName}/spark-logs/experiment/`,
        '--job-bookmark-option': 'job-bookmark-enable',
        '--TempDir': `s3://${props.processedDataBucket.bucketName}/glue-temp/`,
      },
      glueVersion: '4.0',
      workerType: 'G.1X',
      numberOfWorkers: 2,
      timeout: 60,
      maxRetries: 1,
      executionProperty: {
        maxConcurrentRuns: 1,
      },
    });

    new CfnOutput(this, 'RawDatabaseNameOutput', {
      value: this.rawDatabase.ref,
      exportName: `${props.componentName}-${props.environmentName}-raw-database-name`,
    });

    new CfnOutput(this, 'ProcessedDatabaseNameOutput', {
      value: this.processedDatabase.ref,
      exportName: `${props.componentName}-${props.environmentName}-processed-database-name`,
    });

    new CfnOutput(this, 'GlueRoleArnOutput', {
      value: this.glueRole.roleArn,
      exportName: `${props.componentName}-${props.environmentName}-glue-role-arn`,
    });

    new CfnOutput(this, 'BucketingEtlJobNameOutput', {
      value: this.bucketingEtlJob.ref,
      exportName: `${props.componentName}-${props.environmentName}-bucketing-etl-job`,
    });

    new CfnOutput(this, 'ExperimentEtlJobNameOutput', {
      value: this.experimentEtlJob.ref,
      exportName: `${props.componentName}-${props.environmentName}-experiment-etl-job`,
    });
  }
}
