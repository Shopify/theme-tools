import { Context, SourceCodeType, Schema, RelativePath } from '../types';
import { fetch } from 'cross-fetch';
import * as path from '../path';
import { toRemoteAssetUrl } from './remote-asset-url';

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

/**
 * Whether `relativePath` stays in the theme directory that its first segment names (`assets`,
 * `blocks`, `sections`, `snippets`), as the file system reads the path.
 *
 * The rest of the path can come from theme content. `context.toUri` resolves `..`, and a file
 * system decodes the URI once more, where `%2e%2e%2f` is `../`. So without this check, such a
 * path can reach a file outside the theme.
 */
function isInThemeDirectory<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  relativePath: RelativePath,
): boolean {
  const separatorIndex = relativePath.indexOf('/');
  const directory = separatorIndex === -1 ? '' : relativePath.slice(0, separatorIndex);
  const directoryPath = path.fileSystemPath(context.toUri(directory)).replace(/\/?$/, '/');
  return path.fileSystemPath(context.toUri(relativePath)).startsWith(directoryPath);
}

export async function doesFileExist<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  relativePath: RelativePath,
): Promise<boolean> {
  if (!isInThemeDirectory(context, relativePath)) return false;
  const uri = context.toUri(relativePath);
  return await context.fileExists(uri);
}

export async function doesFileExceedThreshold<T extends SourceCodeType, S extends Schema>(
  context: Context<T, S>,
  relativePath: RelativePath,
  thresholdInBytes: number,
): Promise<[exceeds: boolean, fileSize: number]> {
  const uri = context.toUri(relativePath);
  if (!context.fileSize || !isInThemeDirectory(context, relativePath)) return [false, 0];
  const fileSize = await context.fileSize(uri);
  return [fileSize > thresholdInBytes, fileSize];
}

/** Options for `getFileSize`. */
export interface GetFileSizeOptions {
  /**
   * In Node, the `http.Agent` for the request, as node-fetch takes it: cross-fetch uses node-fetch
   * in Node, and the platform's `fetch`, which has no such option, elsewhere.
   */
  agent?: (url: { protocol: string | null }) => unknown;
}

/**
 * The `Content-Length` of a `HEAD` request to `url`, or 0 when the request fails or is refused.
 *
 * It requests only what `toRemoteAssetUrl` allows, and does not follow redirects: a redirect could
 * lead anywhere, so its size is 0.
 */
export async function getFileSize(url: string, options: GetFileSizeOptions = {}): Promise<number> {
  const target = toRemoteAssetUrl(url);
  if (target === undefined) return 0;
  const init: RequestInit & GetFileSizeOptions = { ...options, method: 'HEAD', redirect: 'manual' };
  try {
    const response = await fetch(target, init);

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

/** A check asks for the size of a remote asset only at a URL that `toRemoteAssetUrl` allows. */
export async function hasRemoteAssetSizeExceededThreshold<
  T extends SourceCodeType,
  S extends Schema,
>(context: Context<T, S>, url: string, thresholdInBytes: number) {
  if (toRemoteAssetUrl(url) === undefined) return false;
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
