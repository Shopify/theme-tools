import path from 'path';
import type { ChangesetStatus } from '../types';
import { run, getRepoRoot, readFile } from '../utils';

export const changesetStatus = async (): Promise<ChangesetStatus> => {
  const basefile = `changeset-status.json`;

  try {
    // fetch commits between current branch and main
    console.log(await run('git fetch origin ${GITHUB_REF#refs/heads/} --shallow-exclude main'));
    await run(`yarn changeset status --output=${basefile}`);
  } catch (err) {
    console.log(err);
    console.log(
      'Failed to get changeset status. This can happen if there are no changesets to process for release.',
    );
    console.log(
      "Exiting release process. Please run `yarn changeset status` to see what's going on.",
    );
    process.exit(0);
  }
  const statusFilepath = path.join(await getRepoRoot(), basefile);
  const statusOutput = JSON.parse(await readFile(statusFilepath, 'utf-8'));

  // The output file compiles the status into a parsable object but we don't need it after that
  await run(`rm ${statusFilepath}`);

  return statusOutput;
};
