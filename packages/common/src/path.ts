import { RelativePath, AbsolutePath } from './types';

export function relative(from: AbsolutePath, to: AbsolutePath): RelativePath {
  // TODO do the right thing for windows and shit.
  return from.replace(to, '');
}

export function join(...paths: string[]): string {
  // TODO do the right thing, collapse slashes and shit.
  return paths.join('/');
}
