import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IamStack } from '../stacks/iam-stack';
import { StorageStack } from '../stacks/storage-stack';

/**
 * Grants permissions to the pipeline role for the storage resources.
 */
export function grantPipelineStoragePermissions(
  storage: StorageStack,
  iam: IamStack
): void {
  storage.codeBucket.grantRead(iam.pipelineRole);
  storage.rawDataBucket.grantReadWrite(iam.pipelineRole);
  storage.processedDataBucket.grantReadWrite(iam.pipelineRole);
  storage.rawDataBucket.grantReadWrite(iam.sagemakerJobRole);
  storage.processedDataBucket.grantReadWrite(iam.sagemakerJobRole);
  storage.kmsKey.grantEncryptDecrypt(iam.sagemakerJobRole);
  storage.kmsKey.grantEncryptDecrypt(iam.pipelineRole);
  storage.kmsKey.grantEncryptDecrypt(iam.sagemakerExecutionRole);
  storage.processedDataBucket.grantReadWrite(iam.sagemakerExecutionRole);
  iam.sagemakerExecutionRole.addToPolicy(
    new PolicyStatement({
      actions: ['s3:GetBucketAcl', 's3:PutBucketAcl'],
      resources: [storage.processedDataBucket.bucketArn],
    })
  );
}
