import { Construct } from 'constructs';

import { PipelineStackProps } from '../../types';
import { BasePipelineStack } from './base-pipeline-stack';

export interface ExperimentPipelineStackProps extends PipelineStackProps {
  readonly userFeaturesTableName: string;
  readonly featureGroupName: string;
}

export class ExperimentPipelineStack extends BasePipelineStack {
  constructor(
    scope: Construct,
    id: string,
    props: ExperimentPipelineStackProps
  ) {
    super(scope, id, props, {
      pipelineName: 'bucketing',
      apiResourcePath: 'bucket',
      apiDisplayName: 'User-Bucketing',
      apiDescription: 'API for user bucketing and experiment assignment',
      lambdaCodePath: 'lambdas/bucketing',
      scriptDirectory: 'sagemaker-scripts/bucketing-pipeline',
      lambdaEnvironment: {
        FEATURE_SOURCE: 'mock',
        DYNAMODB_TABLE: props.userFeaturesTableName,
        FEATURE_GROUP_NAME: props.featureGroupName,
      },
    });
  }
}
