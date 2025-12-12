import {
  ScalableTarget,
  TargetTrackingScalingPolicy,
} from 'aws-cdk-lib/aws-applicationautoscaling';
import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';
import { Topic } from 'aws-cdk-lib/aws-sns';

export interface EndpointMonitoringProps {
  componentName: string;
  environmentName: string;
  endpointName: string;
  pipelineName: string;
  displayName?: string;
  useServerless?: boolean;
  invocationTargetValue?: number;
  minCapacity?: number;
  maxCapacity?: number;
}

export interface EndpointMonitoringResources {
  alertsTopic: Topic;
  highLatencyAlarm: Alarm;
  highErrorRateAlarm: Alarm;
  lowInvocationAlarm: Alarm;
  scalableTarget?: ScalableTarget;
  scalingPolicy?: TargetTrackingScalingPolicy;
}
