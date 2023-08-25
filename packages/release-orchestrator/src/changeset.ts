import fs from 'fs';
import path from 'path';

import type { ChangesetStatus } from './types';
import { getRepoRoot, run } from './utils';

export const changesetTag = async () => {
  console.log('Creating git tags for package versions...');
  console.log(await run('yarn changeset tag'));
};

export const changesetVersion = async () => {
  console.log('Running `changeset version`...');

  console.log(await run('yarn changeset version'));
};

export const changesetStatus = async (): Promise<ChangesetStatus> => {
  const basefile = `changeset-status.json`;

  await run(`yarn changeset status --output=${basefile}`);

  const statusFilepath = path.join(await getRepoRoot(), basefile);
  const statusOutput = JSON.parse(fs.readFileSync(statusFilepath, 'utf-8'));

  // The output file compiles the status into a parsable object but we don't need it after that
  await run(`rm ${statusFilepath}`);

  return statusOutput;
};
