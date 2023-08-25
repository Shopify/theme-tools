import { exec } from 'child_process';
import { promisify } from 'node:util';

import type { FileStatus, StageFunction, RunOptions } from './types';
import { memoize } from './memoize';

const execAsync = promisify(exec);

export const getRepoRoot = memoize(() => run('git rev-parse --show-toplevel', false));

export const run = async (cmd: string, runInRepoRoot = true): Promise<string> => {
  const execOptions: RunOptions = runInRepoRoot
    ? { encoding: 'utf-8', cwd: await getRepoRoot() }
    : { encoding: 'utf-8' };
  const { stdout, stderr } = await execAsync(cmd, execOptions);
  if (stderr) {
    console.error(stderr);
    return stderr.trim();
  }

  return stdout.trim();
};

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

/**
 * Async implementation of lodash's flow function
 */
export const flow = (fns: Array<StageFunction>) => async () => {
  let result = undefined;

  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    try {
      result = await fn(result);
    } catch (error) {
      console.error(`Error in function ${fn.name}:`, error);
      throw error; // Re-throw the error so it can be handled upstream
    }
  }

  return result;
};
