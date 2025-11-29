export type SageMakerFramework = 'sklearn' | 'xgboost';

const SKLEARN_IMAGES: Record<string, string> = {
  'us-east-1': '683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'us-east-2': '257758044811.dkr.ecr.us-east-2.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'us-west-1': '746614075791.dkr.ecr.us-west-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'us-west-2': '246618743249.dkr.ecr.us-west-2.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'eu-west-1': '141502667606.dkr.ecr.eu-west-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'eu-west-2': '764974769150.dkr.ecr.eu-west-2.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'eu-central-1': '492215442770.dkr.ecr.eu-central-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'ap-southeast-1': '121021644041.dkr.ecr.ap-southeast-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'ap-southeast-2': '783357654285.dkr.ecr.ap-southeast-2.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
  'ap-northeast-1': '354813040037.dkr.ecr.ap-northeast-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3',
};

const XGBOOST_IMAGES: Record<string, string> = {
  'us-east-1': '683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-xgboost:1.7-1',
  'us-east-2': '257758044811.dkr.ecr.us-east-2.amazonaws.com/sagemaker-xgboost:1.7-1',
  'us-west-1': '746614075791.dkr.ecr.us-west-1.amazonaws.com/sagemaker-xgboost:1.7-1',
  'us-west-2': '246618743249.dkr.ecr.us-west-2.amazonaws.com/sagemaker-xgboost:1.7-1',
  'eu-west-1': '141502667606.dkr.ecr.eu-west-1.amazonaws.com/sagemaker-xgboost:1.7-1',
  'eu-west-2': '764974769150.dkr.ecr.eu-west-2.amazonaws.com/sagemaker-xgboost:1.7-1',
  'eu-central-1': '492215442770.dkr.ecr.eu-central-1.amazonaws.com/sagemaker-xgboost:1.7-1',
  'ap-southeast-1': '121021644041.dkr.ecr.ap-southeast-1.amazonaws.com/sagemaker-xgboost:1.7-1',
  'ap-southeast-2': '783357654285.dkr.ecr.ap-southeast-2.amazonaws.com/sagemaker-xgboost:1.7-1',
  'ap-northeast-1': '354813040037.dkr.ecr.ap-northeast-1.amazonaws.com/sagemaker-xgboost:1.7-1',
};

/**
 * Get the SageMaker image URI for a given region and framework.
 */
export const getSageMakerImageUri = (
  region: string,
  framework: SageMakerFramework = 'sklearn'
): string => {
  const imageMap = framework === 'xgboost' ? XGBOOST_IMAGES : SKLEARN_IMAGES;
  return imageMap[region] ?? imageMap['eu-west-1'];
};
