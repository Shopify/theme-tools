import { run } from './utils';

import { confirmProceed } from './confirm-proceed';

/**
 * Returns a list of all the staged files in the repo.
 */
const stageChanges = async (): Promise<string[]> => {
  const raw = await run('git diff --name-only --cached');
  return raw.trim().split('\n').filter(Boolean);
};

export const gitCommitChanges =
  (message: string, addPattern = ['*']) =>
  async () => {
    for (const pattern of addPattern) {
      await run(`git add ${pattern}`);
    }

    const stagedChanges = await stageChanges();

    if (!stagedChanges.length) {
      return;
    }

    console.log('We need to make a git commit. Awaiting your approval...\n');
    console.log(`${message}:\n\t-`, stagedChanges.join('\n\t- '));

    const proceed = await confirmProceed();

    if (proceed) {
      console.log('Changes have been committed!');
      return run(`git commit -m "${message}"`);
    }

    console.log('Changes have not been committed. Exiting...');
    await run('git restore --staged .');
    process.exit(0);
  };
