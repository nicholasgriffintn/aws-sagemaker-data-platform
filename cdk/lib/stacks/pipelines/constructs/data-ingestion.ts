import { Duration } from "aws-cdk-lib";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction as LambdaTarget } from "aws-cdk-lib/aws-events-targets";
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Key } from "aws-cdk-lib/aws-kms";
import { Code, Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface DataIngestionProps {
  componentName: string;
  environmentName: string;
  rawDataBucket: Bucket;
  dataKey: Key;
  schedule?: Schedule;
  timeout?: Duration;
  memorySize?: number;
  defaultDatasetType?: string;
}

export class DataIngestion extends Construct {
  public readonly lambda: LambdaFunction;

  constructor(scope: Construct, id: string, props: DataIngestionProps) {
    super(scope, id);

    const lambdaRole = new Role(this, 'DataIngestionLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaVPCAccessExecutionRole'
        ),
      ],
    });

    props.rawDataBucket.grantWrite(lambdaRole);
    props.dataKey.grantEncryptDecrypt(lambdaRole);

    lambdaRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    this.lambda = new LambdaFunction(this, 'DataIngestionLambda', {
      functionName: `${props.componentName}-${props.environmentName}-data-ingestion`,
      runtime: Runtime.PYTHON_3_13,
      handler: 'index.handler',
      code: Code.fromAsset('lambdas/data-ingestion'),
      role: lambdaRole,
      timeout: props.timeout ?? Duration.minutes(15),
      memorySize: props.memorySize ?? 1024,
      environment: {
        RAW_DATA_BUCKET: props.rawDataBucket.bucketName,
        KMS_KEY_ID: props.dataKey.keyId,
        DEFAULT_DATASET_TYPE: props.defaultDatasetType ?? 'amazon-reviews',
      },
    });

    const dataIngestionRule = new Rule(this, 'DataIngestionSchedule', {
      schedule: props.schedule ?? Schedule.cron({ hour: '2', minute: '0' }),
    });

    dataIngestionRule.addTarget(new LambdaTarget(this.lambda));
  }
}
