import { Context, SourceCodeType, Schema, RelativePath } from '../types';
import { fetch } from 'cross-fetch';

export async function assertFileExists<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  filePath: RelativePath,
): Promise<boolean> {
  const absolutePath = context.absolutePath(filePath);
  return await context.fileExists(absolutePath);
}

export async function assertFileSize<T extends SourceCodeType, S extends Schema>(
  thresholdInBytes: number,
  fileSize: number,
): Promise<boolean> {
  if (fileSize <= thresholdInBytes) return false;
  return true;
}

export async function getFileSize(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: 'HEAD' });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const fileSize = response.headers.get('Content-Length');
    if (fileSize === null) return 0;
    return parseFloat(fileSize);
  } catch (error) {
    return 0;
  }
}

export async function hasRemoteAssetSizeExceededThreshold(url: string, thresholdInBytes: number) {
  const fileSize = await getFileSize(url);
  return fileSize > thresholdInBytes;
}

export async function hasLocalAssetSizeExceededThreshold<
  T extends SourceCodeType,
  S extends Schema,
>(context: Context<T, S>, path: string, thresholdInBytes: number) {
  const absolutePath = `assets/${path}`;
  const fileExists = await assertFileExists(context, absolutePath);

  if (!fileExists) return;
  const fileSize = await context.fileSize!(absolutePath);
  const fileExceedsThreshold = await assertFileSize(thresholdInBytes, fileSize);

  return fileExceedsThreshold;
}
