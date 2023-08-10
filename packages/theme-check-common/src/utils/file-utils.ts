import { Context, SourceCodeType, Schema, RelativePath } from '../types';

export async function assertFileExists<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  filePath: RelativePath,
): Promise<boolean> {
  const absolutePath = context.absolutePath(filePath);
  return await context.fileExists(absolutePath);
}

export async function assertFileSize<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  filePath: RelativePath,
  thresholdInBytes: number,
): Promise<boolean> {
  const absolutePath = context.absolutePath(filePath);
  const fileSize = await context.fileSize!(absolutePath);
  if (fileSize <= thresholdInBytes) return false;
  return true;
}
