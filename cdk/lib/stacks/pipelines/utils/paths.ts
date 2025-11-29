/**
 * Extracts the directory path from a script location.
 * e.g., 'sagemaker-scripts/bucketing-pipeline/preprocess.py' -> 'sagemaker-scripts/bucketing-pipeline'
 */
export function getScriptDirectory(scriptPath: string): string {
  const parts = scriptPath.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Extracts just the filename from a script path.
 * e.g., 'sagemaker-scripts/bucketing-pipeline/preprocess.py' -> 'preprocess.py'
 */
export function getScriptFilename(scriptPath: string): string {
  const parts = scriptPath.split('/');
  return parts[parts.length - 1];
}
