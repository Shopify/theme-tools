import { Context, SourceCodeType, Schema, RelativePath } from '../types';
import { fetch } from 'cross-fetch';
import * as path from '../path';

const PATH_SEPARATOR = /[/\\]/;

/**
 * Whether `fileName` is the name of a file directly in the theme's assets directory.
 *
 * A file system reads the decoded path of a URI, where `%2e%2e%2f` is `../`. So the name must
 * have no path separator and must not be `.` or `..`, both as written and as the file system
 * reads it.
 */
export function isAssetFileName<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  fileName: string,
): boolean {
  const uri = context.toUri(`assets/${fileName}`);
  const baseName = path.basename(uri);
  return (
    !PATH_SEPARATOR.test(fileName) &&
    !PATH_SEPARATOR.test(baseName) &&
    baseName !== '.' &&
    baseName !== '..' &&
    path.dirname(uri) === context.toUri('assets')
  );
}

export async function doesFileExist<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  relativePath: RelativePath,
): Promise<boolean> {
  const uri = context.toUri(relativePath);
  return await context.fileExists(uri);
}

export async function doesFileExceedThreshold<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  relativePath: RelativePath,
  thresholdInBytes: number,
): Promise<[exceeds: boolean, fileSize: number]> {
  const uri = context.toUri(relativePath);
  if (!context.fileSize) return [false, 0];
  const fileSize = await context.fileSize(uri);
  return [fileSize > thresholdInBytes, fileSize];
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

export async function hasRemoteAssetSizeExceededThreshold<
  T extends SourceCodeType,
  S extends Schema,
>(context: Context<T, S>, url: string, thresholdInBytes: number) {
  const fileSize = await context.remoteFileSize(url);
  return fileSize > thresholdInBytes;
}

export async function hasLocalAssetSizeExceededThreshold<
  T extends SourceCodeType,
  S extends Schema,
>(context: Context<T, S>, relativePath: RelativePath, thresholdInBytes: number) {
  const fileExists = await doesFileExist(context, relativePath);
  if (!fileExists) return false;

  const [fileExceedsThreshold, _fileSize] = await doesFileExceedThreshold(
    context,
    relativePath,
    thresholdInBytes,
  );

  return fileExceedsThreshold;
}
