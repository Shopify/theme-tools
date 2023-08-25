import type { FileStatus } from './types';
import { run } from './utils';

export const gitStatus = async (): Promise<FileStatus[]> => {
  const output = await run('git status --porcelain');
  if (!output) {
    return [];
  }

  return output.split('\n').map((line) => {
    const [status, filepath] = line.trim().split(' ');
    return { status, filepath };
  });
};
