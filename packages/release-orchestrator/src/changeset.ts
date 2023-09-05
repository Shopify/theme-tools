import path from 'path';

import type { ChangesetStatus } from './types';
import { getRepoRoot, readFile, run } from './utils';

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

  try {
    await run(`yarn changeset status --output=${basefile}`);
  } catch (err) {
    console.log(
      'Failed to get changeset status. This can happen if there are no changesets to process for release.',
    );
    console.log(
      "Exiting release process. Please run `yarn changeset status` to see what's going on.",
    );
    process.exit();
  }
  const statusFilepath = path.join(await getRepoRoot(), basefile);
  const statusOutput = JSON.parse(await readFile(statusFilepath, 'utf-8'));

  // The output file compiles the status into a parsable object but we don't need it after that
  await run(`rm ${statusFilepath}`);

  return statusOutput;
};
