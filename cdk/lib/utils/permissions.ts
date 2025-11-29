import { IamStack } from '../stacks/iam-stack';
import { StorageStack } from '../stacks/storage-stack';

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
}
