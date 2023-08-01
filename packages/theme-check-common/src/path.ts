import { RelativePath, AbsolutePath } from './types';

export function relative(absolutePath: AbsolutePath, root: AbsolutePath): RelativePath {
  // TODO (#15): do the right thing for windows and shit.
  return absolutePath.replace(root, '').replace(/^\//, '');
}

export function join(...paths: string[]): string {
  // TODO (#15): do the right thing, collapse slashes and shit.
  return paths.map(removeTrailingSlash).join('/');
}

function removeTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}
