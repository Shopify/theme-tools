import path from 'node:path';
import { fileExists } from '../file-utils';

const DiscoverableConfigFileNames = ['.theme-check.yml'] as const;

export function findConfigPath(root: string): Promise<string | undefined> {
  const paths = DiscoverableConfigFileNames.map((file) => path.join(root, file));
  return find(paths, fileExists);
}

async function find<T>(array: T[], pred: (el: T) => Promise<boolean>): Promise<T | undefined> {
  for (const el of array) {
    if (await pred(el)) {
      return el;
    }
  }
  return undefined;
}
