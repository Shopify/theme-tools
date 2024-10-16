import { UriString } from './AbstractFileSystem';
import * as path from './path';

type FileExists = (uri: string) => Promise<boolean>;

async function isRoot(dir: UriString, fileExists: FileExists) {
  return or(
    fileExists(path.join(dir, 'shopify.extension.toml')), // for theme-app-extensions
    fileExists(path.join(dir, '.theme-check.yml')),
    fileExists(path.join(dir, '.git')),

    // zip files and TAEs might not have config files, but they should have a
    // snippets directory but in case they do specify a .theme-check.yml a
    // couple of directories up, we should respect that
    and(
      fileExists(path.join(dir, 'snippets')),
      not(fileExists(path.join(path.dirname(dir), '.theme-check.yml'))),
      not(fileExists(path.join(path.dirname(path.dirname(dir)), '.theme-check.yml'))),
    ),
  );
}

async function and(...promises: Promise<boolean>[]) {
  const bools = await Promise.all(promises);
  return bools.reduce((a, b) => a && b, true);
}

async function or(...promises: Promise<boolean>[]) {
  const bools = await Promise.all(promises);
  return bools.reduce((a, b) => a || b, false);
}

async function not(ap: Promise<boolean>) {
  const a = await ap;
  return !a;
}

/**
 * Returns the "root" of a theme or theme app extension. The root is the
 * directory that contains a `.theme-check.yml` file, a `.git` directory, or a
 * `shopify.extension.toml` file.
 *
 * There are cases where .theme-check.yml is not defined and we have to infer the root.
 * We'll assume that the root is the directory that contains a `snippets` directory.
 *
 * So you can think of this function as the function that infers where a .theme-check.yml
 * should be.
 */
export async function findRoot(curr: UriString, fileExists: FileExists): Promise<UriString> {
  const currIsRoot = await isRoot(curr, fileExists);
  if (currIsRoot) {
    return curr;
  }

  const dir = path.dirname(curr);
  const currIsAbsoluteRoot = dir === curr;
  if (currIsAbsoluteRoot) {
    return curr;
  }

  return findRoot(dir, fileExists);
}
