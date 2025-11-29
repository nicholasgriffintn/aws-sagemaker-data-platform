import { Duration } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface ScheduledRetrainingProps {
  componentName: string;
  environmentName: string;
  pipelineName: string;
  schedule?: string;
  enabled?: boolean;
}

/**
 * Construct for scheduled model retraining.
 *
 * Creates:
 * - Step Functions state machine to execute the SageMaker Pipeline
 * - EventBridge rule for scheduled execution
 */
export class ScheduledRetraining extends Construct {
  public readonly stateMachine: sfn.StateMachine;
  public readonly scheduledRule: Rule;
  public readonly role: Role;

  constructor(scope: Construct, id: string, props: ScheduledRetrainingProps) {
    super(scope, id);

    this.role = new Role(this, 'StepFunctionsRole', {
      roleName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-sfn-role`,
      assumedBy: new ServicePrincipal('states.amazonaws.com'),
    });

    this.role.addToPolicy(
      new PolicyStatement({
        actions: [
          'sagemaker:StartPipelineExecution',
          'sagemaker:DescribePipelineExecution',
          'sagemaker:ListPipelineExecutionSteps',
        ],
        resources: ['*'],
      })
    );

    const startPipelineExecution = new tasks.CallAwsService(
      this,
      'StartPipelineExecution',
      {
        service: 'sagemaker',
        action: 'startPipelineExecution',
        parameters: {
          PipelineName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-pipeline`,
          PipelineExecutionDisplayName: sfn.JsonPath.format(
            'scheduled-{}',
            sfn.JsonPath.stringAt('$$.Execution.StartTime')
          ),
          PipelineExecutionDescription: 'Scheduled retraining execution',
          ClientRequestToken: sfn.JsonPath.uuid(),
        },
        iamResources: ['*'],
        resultPath: '$.pipelineExecution',
      }
    );

    const waitForExecution = new sfn.Wait(this, 'WaitForExecution', {
      time: sfn.WaitTime.duration(Duration.minutes(5)),
    });

    const checkExecutionStatus = new tasks.CallAwsService(
      this,
      'CheckExecutionStatus',
      {
        service: 'sagemaker',
        action: 'describePipelineExecution',
        parameters: {
          PipelineExecutionArn: sfn.JsonPath.stringAt(
            '$.pipelineExecution.PipelineExecutionArn'
          ),
        },
        iamResources: ['*'],
        resultPath: '$.executionStatus',
      }
    );

    const executionSucceeded = new sfn.Succeed(this, 'ExecutionSucceeded', {
      comment: 'Pipeline execution completed successfully',
    });

    const executionFailed = new sfn.Fail(this, 'ExecutionFailed', {
      cause: 'Pipeline execution failed',
      error: 'PIPELINE_EXECUTION_FAILED',
    });

    const isExecutionComplete = new sfn.Choice(this, 'IsExecutionComplete')
      .when(
        sfn.Condition.stringEquals(
          '$.executionStatus.PipelineExecutionStatus',
          'Succeeded'
        ),
        executionSucceeded
      )
      .when(
        sfn.Condition.stringEquals(
          '$.executionStatus.PipelineExecutionStatus',
          'Failed'
        ),
        executionFailed
      )
      .when(
        sfn.Condition.stringEquals(
          '$.executionStatus.PipelineExecutionStatus',
          'Stopped'
        ),
        executionFailed
      )
      .otherwise(waitForExecution);

    const definition = startPipelineExecution
      .next(waitForExecution)
      .next(checkExecutionStatus)
      .next(isExecutionComplete);

    this.stateMachine = new sfn.StateMachine(this, 'RetrainingStateMachine', {
      stateMachineName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-retraining`,
      definition,
      role: this.role,
      timeout: Duration.hours(6),
    });

    const scheduleExpression = props.schedule ?? 'cron(0 2 ? * SUN *)';

    this.scheduledRule = new Rule(this, 'ScheduledRule', {
      ruleName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-scheduled-retraining`,
      description: `Scheduled retraining for ${props.pipelineName} pipeline`,
      schedule: Schedule.expression(scheduleExpression),
      enabled: props.enabled ?? true,
    });

    this.scheduledRule.addTarget(new SfnStateMachine(this.stateMachine));
  }
}
