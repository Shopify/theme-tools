import { RelativePath, AbsolutePath } from './types';

export function relative(absolutePath: AbsolutePath, root: AbsolutePath): RelativePath {
  return absolutePath.replace(root, '').replace(/^\//, '');
}

export function join(...paths: string[]): string {
  return paths.map(removeTrailingSlash).join('/');
}

function removeTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}
