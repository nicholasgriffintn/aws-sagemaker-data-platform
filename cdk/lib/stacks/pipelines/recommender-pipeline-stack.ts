import { Construct } from 'constructs';

import { PipelineStackProps } from '../../types';
import { BasePipelineStack } from './base-pipeline-stack';

export class RecommenderPipelineStack extends BasePipelineStack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props, {
      pipelineName: 'recommender',
      apiResourcePath: 'recommend',
      apiDisplayName: 'ML-Recommender',
      apiDescription: 'API for ML experiment recommendations',
      lambdaCodePath: 'lambdas/recommender',
      lambdaMemorySize: 512,
      scriptDirectory: 'sagemaker-scripts/recommender-pipeline',
      framework: 'xgboost',
      lambdaEnvironment: {
        USE_BEDROCK_PARSER: 'false',
        BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
      },
    });
  }
}
