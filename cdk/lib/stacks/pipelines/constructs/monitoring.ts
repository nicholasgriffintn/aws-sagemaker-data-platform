import { Duration } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { ScalableTarget, ServiceNamespace, TargetTrackingScalingPolicy, PredefinedMetric } from "aws-cdk-lib/aws-applicationautoscaling";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

import { EndpointMonitoringProps } from '../types/monitoring';

export class EndpointMonitoring extends Construct {
  public readonly alertsTopic: Topic;
  public readonly highLatencyAlarm: Alarm;
  public readonly highErrorRateAlarm: Alarm;
  public readonly lowInvocationAlarm: Alarm;
  public readonly scalableTarget: ScalableTarget;
  public readonly scalingPolicy: TargetTrackingScalingPolicy;

  constructor(scope: Construct, id: string, props: EndpointMonitoringProps) {
    super(scope, id);

    this.alertsTopic = new Topic(this, 'AlertsTopic', {
      topicName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-alerts`,
      displayName: props.displayName ?? 'Pipeline Alerts',
    });

    const variantName = 'primary';
    const endpointMetricDimensions = {
      EndpointName: props.endpointName,
      VariantName: variantName,
    };

    this.highLatencyAlarm = new Alarm(this, 'HighLatencyAlarm', {
      alarmName: `${props.componentName}-${props.environmentName}-high-latency`,
      alarmDescription: 'Endpoint latency is too high',
      metric: new Metric({
        namespace: 'AWS/SageMaker',
        metricName: 'ModelLatency',
        dimensionsMap: endpointMetricDimensions,
        statistic: 'Average',
      }),
      threshold: 5000,
      evaluationPeriods: 2,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.highLatencyAlarm.addAlarmAction(new SnsAction(this.alertsTopic));

    this.highErrorRateAlarm = new Alarm(this, 'HighErrorRateAlarm', {
      alarmName: `${props.componentName}-${props.environmentName}-high-error-rate`,
      alarmDescription: 'Endpoint error rate is too high',
      metric: new Metric({
        namespace: 'AWS/SageMaker',
        metricName: 'Invocation4XXErrors',
        dimensionsMap: endpointMetricDimensions,
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    this.highErrorRateAlarm.addAlarmAction(new SnsAction(this.alertsTopic));

    this.lowInvocationAlarm = new Alarm(this, 'LowInvocationAlarm', {
      alarmName: `${props.componentName}-${props.environmentName}-low-invocation`,
      alarmDescription: 'Endpoint invocation count is unusually low',
      metric: new Metric({
        namespace: 'AWS/SageMaker',
        metricName: 'Invocations',
        dimensionsMap: endpointMetricDimensions,
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 6,
      comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.BREACHING,
    });
    this.lowInvocationAlarm.addAlarmAction(new SnsAction(this.alertsTopic));

    this.scalableTarget = new ScalableTarget(this, 'EndpointScalableTarget', {
      serviceNamespace: ServiceNamespace.SAGEMAKER,
      resourceId: `endpoint/${props.endpointName}/variant/${variantName}`,
      scalableDimension: 'sagemaker:variant:DesiredInstanceCount',
      minCapacity: props.minCapacity ?? 1,
      maxCapacity: props.maxCapacity ?? 5,
    });

    this.scalingPolicy = new TargetTrackingScalingPolicy(
      this,
      'EndpointScalingPolicy',
      {
        scalingTarget: this.scalableTarget,
        targetValue: props.invocationTargetValue ?? 100,
        predefinedMetric:
          PredefinedMetric.SAGEMAKER_VARIANT_INVOCATIONS_PER_INSTANCE,
        scaleOutCooldown: Duration.minutes(5),
        scaleInCooldown: Duration.minutes(10),
      }
    );
  }
}
