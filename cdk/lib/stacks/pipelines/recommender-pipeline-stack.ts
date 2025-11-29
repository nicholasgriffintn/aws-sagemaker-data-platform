import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as glue from 'aws-cdk-lib/aws-glue';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Role } from 'aws-cdk-lib/aws-iam';

export interface RecommenderPipelineStackProps extends StackProps {
  environmentName: string;
  componentName: string;
  readonly processedDataBucket: Bucket;
  readonly sagemakerExecutionRole: Role;
  readonly lambdaExecutionRole: Role;
  readonly glueRole: Role;
  readonly databaseName: string;
}

/**
 * ML Recommender Pipeline Stack
 *
 * This stack creates the ML experiment recommender pipeline including:
 * - Glue ETL job for feature engineering
 * - Glue crawlers for metadata and results
 * - SageMaker model and endpoint for recommendations
 * - Lambda function and API Gateway for serving recommendations
 */
export class RecommenderPipelineStack extends Stack {
  public readonly endpoint: sagemaker.CfnEndpoint;
  public readonly api: apigw.RestApi;

  constructor(
    scope: Construct,
    id: string,
    props: RecommenderPipelineStackProps
  ) {
    super(scope, id, props);

    // Glue Crawlers for raw experiment data
    new glue.CfnCrawler(this, 'MetadataCrawler', {
      role: props.glueRole.roleArn,
      databaseName: props.databaseName,
      targets: {
        s3Targets: [
          {
            path: `s3://${props.processedDataBucket.bucketName}/raw/experiments/metadata/`,
          },
        ],
      },
      schedule: {
        scheduleExpression: 'cron(0 * * * ? *)',
      },
    });

    new glue.CfnCrawler(this, 'ResultsCrawler', {
      role: props.glueRole.roleArn,
      databaseName: props.databaseName,
      targets: {
        s3Targets: [
          {
            path: `s3://${props.processedDataBucket.bucketName}/raw/experiments/results/`,
          },
        ],
      },
      schedule: {
        scheduleExpression: 'cron(0 * * * ? *)',
      },
    });

    // Glue ETL Job for feature engineering
    new glue.CfnJob(this, 'FeatureETLJob', {
      name: `${props.componentName}-${props.environmentName}-ml-experiment-feature-etl`,
      role: props.glueRole.roleArn,
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: `s3://${props.processedDataBucket.bucketName}/scripts/feature_etl.py`,
      },
      defaultArguments: {
        '--raw_bucket': `s3://${props.processedDataBucket.bucketName}/raw/experiments`,
        '--out_bucket': `s3://${props.processedDataBucket.bucketName}/processed/experiments_ml/features`,
        '--enable-continuous-cloudwatch-log': 'true',
        '--enable-metrics': '',
      },
      glueVersion: '4.0',
      maxRetries: 0,
      numberOfWorkers: 10,
      workerType: 'G.1X',
    });

    // SageMaker Model using XGBoost container
    const model = new sagemaker.CfnModel(this, 'UpliftModel', {
      executionRoleArn: props.sagemakerExecutionRole.roleArn,
      primaryContainer: {
        image: '683313688378.dkr.ecr.eu-west-1.amazonaws.com/xgboost:1',
        modelDataUrl: `s3://${props.processedDataBucket.bucketName}/model-artifacts/model.tar.gz`,
      },
    });

    // SageMaker Endpoint Configuration
    const endpointConfig = new sagemaker.CfnEndpointConfig(
      this,
      'EndpointConfig',
      {
        productionVariants: [
          {
            modelName: model.attrModelName,
            initialInstanceCount: 1,
            instanceType: 'ml.m5.large',
            variantName: 'AllTraffic',
          },
        ],
      }
    );

    // SageMaker Endpoint
    this.endpoint = new sagemaker.CfnEndpoint(this, 'Endpoint', {
      endpointName: `${props.componentName}-${props.environmentName}-recommender-endpoint`,
      endpointConfigName: endpointConfig.attrEndpointConfigName,
    });

    // Lambda function for serving recommendations
    const recommenderLambda = new lambda.Function(this, 'RecommenderLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambdas/recommender'),
      role: props.lambdaExecutionRole,
      environment: {
        ENDPOINT_NAME: this.endpoint.endpointName!,
      },
    });

    // API Gateway for exposing the recommender
    this.api = new apigw.RestApi(this, 'RecommenderApi', {
      restApiName: `${props.componentName}-${props.environmentName}-ML-Experiment-Recommender`,
      description: 'API for ML experiment recommendations',
    });

    const recommend = this.api.root.addResource('recommend');
    recommend.addMethod('POST', new apigw.LambdaIntegration(recommenderLambda));
  }
}
