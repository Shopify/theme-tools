import { exec } from 'child_process';
import { promisify } from 'node:util';
import fs from 'fs';
import crypto from 'crypto';

import { memoize } from './memoize';
import type { RunOptions } from './types';

const execAsync = promisify(exec);
export const readFile = promisify(fs.readFile);

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

export const getRandomId = (numChars: number) => crypto.randomBytes(numChars).toString('hex');
