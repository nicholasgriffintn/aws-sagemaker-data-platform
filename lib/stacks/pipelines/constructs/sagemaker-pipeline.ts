import { CfnPipeline } from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

import { SageMakerPipelineProps, PipelineScriptLocations } from '../types';

export class SageMakerPipeline extends Construct {
  public readonly pipeline: CfnPipeline;

  constructor(scope: Construct, id: string, props: SageMakerPipelineProps) {
    super(scope, id);

    const scripts: PipelineScriptLocations = {
      preprocessing: props.scriptLocations?.preprocessing ?? 'preprocessing.py',
      training: props.scriptLocations?.training ?? 'training.py',
      evaluation: props.scriptLocations?.evaluation ?? 'evaluation.py',
      inference: props.scriptLocations?.inference ?? 'inference.py',
    };

    const defaults = {
      inputDataUrl: `s3://${props.rawDataBucket.bucketName}/${props.pipelineName}/data/`,
      modelApprovalStatus: 'PendingManualApproval',
      processingInstanceType: props.primaryInstanceType,
      trainingInstanceType: props.primaryInstanceType,
      modelType: 'random_forest',
      nEstimators: '100',
      maxDepth: '10',
    };

    const parameters = {
      inputDataUrl:
        props.parameterOverrides?.inputDataUrl ?? defaults.inputDataUrl,
      modelApprovalStatus:
        props.parameterOverrides?.modelApprovalStatus ??
        defaults.modelApprovalStatus,
      processingInstanceType:
        props.parameterOverrides?.processingInstanceType ??
        defaults.processingInstanceType,
      trainingInstanceType:
        props.parameterOverrides?.trainingInstanceType ??
        defaults.trainingInstanceType,
      modelType: props.parameterOverrides?.modelType ?? defaults.modelType,
      nEstimators:
        props.parameterOverrides?.nEstimators ?? defaults.nEstimators,
      maxDepth: props.parameterOverrides?.maxDepth ?? defaults.maxDepth,
    };

    const pipelineDefinition = {
      Version: '2020-12-01',
      Metadata: {},
      Parameters: [
        {
          Name: 'InputDataUrl',
          Type: 'String',
          DefaultValue: parameters.inputDataUrl,
        },
        {
          Name: 'ModelApprovalStatus',
          Type: 'String',
          DefaultValue: parameters.modelApprovalStatus,
        },
        {
          Name: 'ProcessingInstanceType',
          Type: 'String',
          DefaultValue: parameters.processingInstanceType,
        },
        {
          Name: 'TrainingInstanceType',
          Type: 'String',
          DefaultValue: parameters.trainingInstanceType,
        },
        {
          Name: 'ModelType',
          Type: 'String',
          DefaultValue: parameters.modelType,
        },
        {
          Name: 'NEstimators',
          Type: 'String',
          DefaultValue: parameters.nEstimators,
        },
        {
          Name: 'MaxDepth',
          Type: 'String',
          DefaultValue: parameters.maxDepth,
        },
      ],
      PipelineExperimentConfig: {
        ExperimentName: `${props.componentName}-${props.environmentName}-name`,
        TrialName: `${props.componentName}-${props.environmentName}-trial`,
      },
      Steps: [
        {
          Name: 'DataPreprocessing',
          Type: 'Processing',
          Arguments: {
            ProcessingResources: {
              ClusterConfig: {
                InstanceType: { Get: 'Parameters.ProcessingInstanceType' },
                InstanceCount: 1,
                VolumeSizeInGB: 30,
              },
            },
            AppSpecification: {
              ImageUri: props.sagemakerImageUri,
              ContainerEntrypoint: [
                'python3',
                `/opt/ml/processing/code/${scripts.preprocessing}`,
              ],
            },
            RoleArn: props.pipelineRole.roleArn,
            ProcessingInputs: [
              {
                InputName: 'input-data',
                AppManaged: false,
                S3Input: {
                  S3Uri: { Get: 'Parameters.InputDataUrl' },
                  LocalPath: '/opt/ml/processing/input',
                  S3DataType: 'S3Prefix',
                  S3InputMode: 'File',
                  S3DataDistributionType: 'FullyReplicated',
                  S3CompressionType: 'None',
                },
              },
              {
                InputName: 'code',
                AppManaged: false,
                S3Input: {
                  S3Uri: `s3://${props.codeBucket.bucketName}/sagemaker-scripts/`,
                  LocalPath: '/opt/ml/processing/code',
                  S3DataType: 'S3Prefix',
                  S3InputMode: 'File',
                  S3DataDistributionType: 'FullyReplicated',
                  S3CompressionType: 'None',
                },
              },
            ],
            ProcessingOutputs: [
              {
                OutputName: 'train',
                AppManaged: false,
                S3Output: {
                  S3Uri: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/processed/train`,
                  LocalPath: '/opt/ml/processing/train',
                  S3UploadMode: 'EndOfJob',
                },
              },
              {
                OutputName: 'validation',
                AppManaged: false,
                S3Output: {
                  S3Uri: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/processed/validation`,
                  LocalPath: '/opt/ml/processing/validation',
                  S3UploadMode: 'EndOfJob',
                },
              },
              {
                OutputName: 'test',
                AppManaged: false,
                S3Output: {
                  S3Uri: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/processed/test`,
                  LocalPath: '/opt/ml/processing/test',
                  S3UploadMode: 'EndOfJob',
                },
              },
            ],
          },
        },
        {
          Name: 'ModelTraining',
          Type: 'Training',
          Arguments: {
            AlgorithmSpecification: {
              TrainingImage: props.sagemakerImageUri,
              TrainingInputMode: 'File',
            },
            RoleArn: props.pipelineRole.roleArn,
            InputDataConfig: [
              {
                ChannelName: 'training',
                DataSource: {
                  S3DataSource: {
                    S3DataType: 'S3Prefix',
                    S3Uri: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/processed/train`,
                    S3DataDistributionType: 'FullyReplicated',
                  },
                },
              },
              {
                ChannelName: 'validation',
                DataSource: {
                  S3DataSource: {
                    S3DataType: 'S3Prefix',
                    S3Uri: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/processed/validation`,
                    S3DataDistributionType: 'FullyReplicated',
                  },
                },
              },
            ],
            OutputDataConfig: {
              S3OutputPath: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/models`,
            },
            ResourceConfig: {
              InstanceType: { Get: 'Parameters.TrainingInstanceType' },
              InstanceCount: 1,
              VolumeSizeInGB: 30,
            },
            StoppingCondition: {
              MaxRuntimeInSeconds: 3600,
            },
            HyperParameters: {
              model_type: { Get: 'Parameters.ModelType' },
              n_estimators: { Get: 'Parameters.NEstimators' },
              max_depth: { Get: 'Parameters.MaxDepth' },
              random_state: '42',
            },
            Environment: {
              SAGEMAKER_PROGRAM: scripts.training,
              SAGEMAKER_SUBMIT_DIRECTORY: `s3://${props.codeBucket.bucketName}/`,
            },
            VpcConfig: {
              SecurityGroupIds: [props.securityGroup.securityGroupId],
              Subnets: props.vpc.privateSubnets.map(
                (subnet) => subnet.subnetId
              ),
            },
            EnableNetworkIsolation: true,
          },
        },
        {
          Name: 'ModelEvaluation',
          Type: 'Processing',
          Arguments: {
            ProcessingResources: {
              ClusterConfig: {
                InstanceType: props.primaryInstanceType,
                InstanceCount: 1,
                VolumeSizeInGB: 30,
              },
            },
            AppSpecification: {
              ImageUri: props.sagemakerImageUri,
              ContainerEntrypoint: [
                'python3',
                `/opt/ml/processing/code/${scripts.evaluation}`,
              ],
            },
            RoleArn: props.pipelineRole.roleArn,
            ProcessingInputs: [
              {
                InputName: 'model',
                AppManaged: false,
                S3Input: {
                  S3Uri: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/models`,
                  LocalPath: '/opt/ml/processing/model',
                  S3DataType: 'S3Prefix',
                  S3InputMode: 'File',
                },
              },
              {
                InputName: 'test-data',
                AppManaged: false,
                S3Input: {
                  S3Uri: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/processed/test`,
                  LocalPath: '/opt/ml/processing/test',
                  S3DataType: 'S3Prefix',
                  S3InputMode: 'File',
                },
              },
            ],
            ProcessingOutputs: [
              {
                OutputName: 'evaluation',
                AppManaged: false,
                S3Output: {
                  S3Uri: `s3://${props.processedDataBucket.bucketName}/${props.pipelineName}-pipeline/evaluation`,
                  LocalPath: '/opt/ml/processing/evaluation',
                  S3UploadMode: 'EndOfJob',
                },
              },
            ],
            PropertyFiles: [
              {
                PropertyFileName: 'EvaluationReport',
                OutputName: 'evaluation',
                FilePath: 'model_approval.json',
              },
            ],
          },
        },
        {
          Name: 'CheckModelApproval',
          Type: 'Condition',
          Arguments: {
            Conditions: [
              {
                Type: 'Equals',
                LeftValue: {
                  'Std:JsonGet': {
                    PropertyFile: {
                      Get: 'Steps.ModelEvaluation.PropertyFiles.EvaluationReport',
                    },
                    Path: 'approve_model',
                  },
                },
                RightValue: true,
              },
            ],
            IfSteps: [
              {
                Name: 'RegisterApprovedModel',
                Type: 'RegisterModel',
                Arguments: {
                  ModelName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-model`,
                  ModelPackageGroupName: `${props.componentName}-${props.environmentName}-${props.pipelineName}-models`,
                  ModelApprovalStatus: 'Approved',
                  InferenceSpecification: {
                    Containers: [
                      {
                        Image: props.sagemakerImageUri,
                        ModelDataUrl: {
                          Get: 'Steps.ModelTraining.ModelArtifacts.S3ModelArtifacts',
                        },
                        Environment: {
                          SAGEMAKER_PROGRAM: scripts.inference,
                          SAGEMAKER_SUBMIT_DIRECTORY: `s3://${props.codeBucket.bucketName}/`,
                        },
                      },
                    ],
                    SupportedContentTypes: ['application/json'],
                    SupportedResponseMIMETypes: ['application/json'],
                    SupportedRealtimeInferenceInstanceTypes: [
                      props.primaryInstanceType,
                      props.secondaryInstanceType,
                    ],
                    SupportedTransformInstanceTypes: [
                      props.primaryInstanceType,
                      props.secondaryInstanceType,
                    ],
                  },
                  ModelMetrics: {
                    ModelQuality: {
                      Statistics: {
                        ContentType: 'application/json',
                        S3Uri: {
                          'Std:Join': {
                            On: '/',
                            Values: [
                              {
                                Get: 'Steps.ModelEvaluation.ProcessingOutputs.evaluation.S3Output.S3Uri',
                              },
                              'evaluation_metrics.json',
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            ElseSteps: [
              {
                Name: 'RejectModel',
                Type: 'Fail',
                Arguments: {
                  ErrorMessage: 'Model did not meet approval criteria',
                },
              },
            ],
          },
        },
      ],
    };

    this.pipeline = new CfnPipeline(this, 'SagemakerPipeline', {
      pipelineName: `${props.componentName}-${props.environmentName}-${
        props.pipelineNameSuffix ?? `${props.pipelineName}-bucketing-pipeline`
      }`,
      pipelineDefinition,
      roleArn: props.pipelineRole.roleArn,
      pipelineDescription: `Pipeline for ${props.pipelineName}`,
    });
  }
}
