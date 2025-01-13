import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

export const exec = promisify(execCb) as (
  command: string,
  options?: { encoding: BufferEncoding },
) => Promise<{ stdout: string; stderr: string }>;
