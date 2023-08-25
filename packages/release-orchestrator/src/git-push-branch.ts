import { confirmProceed } from './confirm-proceed';
import { run } from './utils';

/**
 * Force pushes the current branch to the remote repository.
 *
 * This function will prompt the user for confirmation before proceeding with the push.
 * If the user confirms, it will force push the current branch to the remote repository,
 * overwriting the contents in the remote branch with the local branch.
 *
 * If the user does not confirm, it will print 'Operation cancelled.' and will not push the branch.
 *
 * Please be aware that force pushing can be dangerous because it can permanently overwrite changes in the remote repository.
 * Always make sure you know what you're doing and that you won't lose any important changes before force pushing.
 */
export const gitPushBranch = (branchName: string) => async (): Promise<void> => {
  console.log(
    `
You are about to force push the current branch '${branchName}' to the remote repository. 
If this branch already exists remotely, this will overwrite the contents in the remote branch.`,
  );
  const proceed = await confirmProceed();

  if (proceed) {
    await run(`git push --force origin ${branchName}`);
  } else {
    console.log('You have chosen not to push the current branch. Operation cancelled.');
    process.exit();
  }
};
