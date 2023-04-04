import { RelativePath, AbsolutePath } from './types';

export function relative(from: AbsolutePath, to: AbsolutePath): RelativePath {
  // TODO (#15): do the right thing for windows and shit.
  return from.replace(to, '');
}

export function join(...paths: string[]): string {
  // TODO (#15): do the right thing, collapse slashes and shit.
  return paths.map(removeTrailingSlash).join('/');
}

function removeTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '');
}
