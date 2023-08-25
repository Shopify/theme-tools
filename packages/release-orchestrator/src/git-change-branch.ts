import { confirmProceed } from './confirm-proceed';
import { run } from './utils';

export const gitChangeBranch = (branchName: string) => async (): Promise<void> => {
  console.log(`You are about to change to branch '${branchName}'.`);
  const proceed = await confirmProceed();

  if (proceed) {
    const output = await run(`git checkout -B ${branchName}`);

    if (output.includes(`fatal: a branch named '${branchName}' already exists`)) {
      console.log('Detected an existing local branch. Please delete it before retrying.');
      process.exit();
    }
  } else {
    console.log('Operation cancelled.');
    process.exit();
  }
};
