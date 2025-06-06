import path from 'path';
import type { ChangesetStatus } from '../types';
import { run, getRepoRoot, readFile } from '../utils';

export const changesetStatus = async (): Promise<ChangesetStatus> => {
  const basefile = `changeset-status.json`;

  try {
    await run(`yarn changeset status --output=${basefile}`);
  } catch (err) {
    console.log('Failed to get changeset status. This should not be happening...');
    console.log('Exiting changeset version process.');
    console.log(err);
    process.exit(1);
  }
  const statusFilepath = path.join(await getRepoRoot(), basefile);
  const statusOutput = JSON.parse(await readFile(statusFilepath, 'utf-8'));

  // The output file compiles the status into a parsable object but we don't need it after that
  await run(`rm ${statusFilepath}`);

  return statusOutput;
};
