import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface DataPipelineStackProps extends StackProps {
  environmentName: string;
  componentName: string;
  rawDataBucket: s3.IBucket;
  processedDataBucket: s3.IBucket;
  bucketingEtlJobName: string;
  experimentEtlJobName: string;
  bucketingPipelineName: string;
  recommenderPipelineName: string;
}

/**
 * Stack for orchestrating the complete data pipeline workflow.
 *
 * Creates Step Functions state machines for:
 * - Full data pipeline: Raw data → Glue ETL → SageMaker Pipeline
 * - Bucketing pipeline workflow
 * - Recommender pipeline workflow
 * - Scheduled execution rules
 */
export class DataPipelineStack extends Stack {
  public readonly dataPipelineRole: iam.Role;
  public readonly bucketingWorkflow: sfn.StateMachine;
  public readonly recommenderWorkflow: sfn.StateMachine;
  public readonly fullPipelineWorkflow: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: DataPipelineStackProps) {
    super(scope, id, props);

    this.dataPipelineRole = new iam.Role(this, 'DataPipelineRole', {
      roleName: `${props.componentName}-${props.environmentName}-data-pipeline-role`,
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });

    this.dataPipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'glue:StartJobRun',
          'glue:GetJobRun',
          'glue:GetJobRuns',
          'glue:BatchStopJobRun',
        ],
        resources: [
          `arn:aws:glue:${this.region}:${this.account}:job/${props.bucketingEtlJobName}`,
          `arn:aws:glue:${this.region}:${this.account}:job/${props.experimentEtlJobName}`,
        ],
      })
    );

    this.dataPipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'sagemaker:StartPipelineExecution',
          'sagemaker:DescribePipelineExecution',
          'sagemaker:StopPipelineExecution',
        ],
        resources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.bucketingPipelineName}`,
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.recommenderPipelineName}`,
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.bucketingPipelineName}/*`,
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.recommenderPipelineName}/*`,
        ],
      })
    );

    props.rawDataBucket.grantRead(this.dataPipelineRole);
    props.processedDataBucket.grantRead(this.dataPipelineRole);

    this.dataPipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:CreateLogDelivery',
          'logs:GetLogDelivery',
          'logs:UpdateLogDelivery',
          'logs:DeleteLogDelivery',
          'logs:ListLogDeliveries',
          'logs:PutResourcePolicy',
          'logs:DescribeResourcePolicies',
          'logs:DescribeLogGroups',
        ],
        resources: ['*'],
      })
    );

    const runBucketingEtl = new tasks.GlueStartJobRun(this, 'RunBucketingETL', {
      glueJobName: props.bucketingEtlJobName,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      resultPath: '$.glueResult',
    });

    const runExperimentEtl = new tasks.GlueStartJobRun(
      this,
      'RunExperimentETL',
      {
        glueJobName: props.experimentEtlJobName,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        resultPath: '$.glueResult',
      }
    );

    const startBucketingPipeline = new tasks.CallAwsService(
      this,
      'StartBucketingPipeline',
      {
        service: 'sagemaker',
        action: 'startPipelineExecution',
        parameters: {
          PipelineName: props.bucketingPipelineName,
          ClientRequestToken: sfn.JsonPath.uuid(),
        },
        iamResources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.bucketingPipelineName}`,
        ],
        resultPath: '$.sagemakerResult',
      }
    );

    const startRecommenderPipeline = new tasks.CallAwsService(
      this,
      'StartRecommenderPipeline',
      {
        service: 'sagemaker',
        action: 'startPipelineExecution',
        parameters: {
          PipelineName: props.recommenderPipelineName,
          ClientRequestToken: sfn.JsonPath.uuid(),
        },
        iamResources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.recommenderPipelineName}`,
        ],
        resultPath: '$.sagemakerResult',
      }
    );

    const pipelineSuccess = new sfn.Succeed(this, 'PipelineSuccess', {
      comment: 'Pipeline completed successfully',
    });

    const bucketingChain = sfn.Chain.start(runBucketingEtl)
      .next(startBucketingPipeline)
      .next(pipelineSuccess);

    this.bucketingWorkflow = new sfn.StateMachine(
      this,
      'BucketingDataPipeline',
      {
        stateMachineName: `${props.componentName}-${props.environmentName}-bucketing-data-pipeline`,
        definitionBody: sfn.DefinitionBody.fromChainable(bucketingChain),
        role: this.dataPipelineRole,
        timeout: Duration.hours(4),
        tracingEnabled: true,
      }
    );

    const recommenderEtlTask = new tasks.GlueStartJobRun(
      this,
      'RunExperimentETLForRecommender',
      {
        glueJobName: props.experimentEtlJobName,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        resultPath: '$.glueResult',
      }
    );

    const recommenderPipelineTask = new tasks.CallAwsService(
      this,
      'StartRecommenderPipelineTask',
      {
        service: 'sagemaker',
        action: 'startPipelineExecution',
        parameters: {
          PipelineName: props.recommenderPipelineName,
          ClientRequestToken: sfn.JsonPath.uuid(),
        },
        iamResources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.recommenderPipelineName}`,
        ],
        resultPath: '$.sagemakerResult',
      }
    );

    const recommenderSuccess = new sfn.Succeed(
      this,
      'RecommenderPipelineSuccess',
      {
        comment: 'Recommender pipeline completed successfully',
      }
    );

    const recommenderChain = sfn.Chain.start(recommenderEtlTask)
      .next(recommenderPipelineTask)
      .next(recommenderSuccess);

    this.recommenderWorkflow = new sfn.StateMachine(
      this,
      'RecommenderDataPipeline',
      {
        stateMachineName: `${props.componentName}-${props.environmentName}-recommender-data-pipeline`,
        definitionBody: sfn.DefinitionBody.fromChainable(recommenderChain),
        role: this.dataPipelineRole,
        timeout: Duration.hours(4),
        tracingEnabled: true,
      }
    );

    const parallelEtl = new sfn.Parallel(this, 'ParallelETLJobs', {
      resultPath: '$.etlResults',
    });

    const bucketingEtlBranch = new tasks.GlueStartJobRun(
      this,
      'BucketingETLBranch',
      {
        glueJobName: props.bucketingEtlJobName,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }
    );

    const experimentEtlBranch = new tasks.GlueStartJobRun(
      this,
      'ExperimentETLBranch',
      {
        glueJobName: props.experimentEtlJobName,
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      }
    );

    parallelEtl.branch(bucketingEtlBranch);
    parallelEtl.branch(experimentEtlBranch);

    const parallelMlPipelines = new sfn.Parallel(this, 'ParallelMLPipelines', {
      resultPath: '$.mlResults',
    });

    const bucketingMlBranch = new tasks.CallAwsService(
      this,
      'BucketingMLBranch',
      {
        service: 'sagemaker',
        action: 'startPipelineExecution',
        parameters: {
          PipelineName: props.bucketingPipelineName,
          ClientRequestToken: sfn.JsonPath.uuid(),
        },
        iamResources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.bucketingPipelineName}`,
        ],
      }
    );

    const recommenderMlBranch = new tasks.CallAwsService(
      this,
      'RecommenderMLBranch',
      {
        service: 'sagemaker',
        action: 'startPipelineExecution',
        parameters: {
          PipelineName: props.recommenderPipelineName,
          ClientRequestToken: sfn.JsonPath.uuid(),
        },
        iamResources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:pipeline/${props.recommenderPipelineName}`,
        ],
      }
    );

    parallelMlPipelines.branch(bucketingMlBranch);
    parallelMlPipelines.branch(recommenderMlBranch);

    const fullPipelineSuccess = new sfn.Succeed(this, 'FullPipelineSuccess', {
      comment: 'Full data pipeline completed successfully',
    });

    const fullPipelineChain = sfn.Chain.start(parallelEtl)
      .next(parallelMlPipelines)
      .next(fullPipelineSuccess);

    this.fullPipelineWorkflow = new sfn.StateMachine(this, 'FullDataPipeline', {
      stateMachineName: `${props.componentName}-${props.environmentName}-full-data-pipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(fullPipelineChain),
      role: this.dataPipelineRole,
      timeout: Duration.hours(6),
      tracingEnabled: true,
    });

    new CfnOutput(this, 'BucketingWorkflowArn', {
      value: this.bucketingWorkflow.stateMachineArn,
      description: 'Bucketing data pipeline workflow ARN',
      exportName: `${props.componentName}-${props.environmentName}-bucketing-workflow-arn`,
    });

    new CfnOutput(this, 'RecommenderWorkflowArn', {
      value: this.recommenderWorkflow.stateMachineArn,
      description: 'Recommender data pipeline workflow ARN',
      exportName: `${props.componentName}-${props.environmentName}-recommender-workflow-arn`,
    });

    new CfnOutput(this, 'FullPipelineWorkflowArn', {
      value: this.fullPipelineWorkflow.stateMachineArn,
      description: 'Full data pipeline workflow ARN',
      exportName: `${props.componentName}-${props.environmentName}-full-pipeline-workflow-arn`,
    });
  }
}
