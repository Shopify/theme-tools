import { gitStatus } from './git-status';
import { run } from './utils';
import { flow } from './flow';

const EXPECTED_BRANCH = 'main';
const SANITY_WARNING = `
*******************
WARNING: Skipping sanity checks is not recommended for production releases.
This can result in unexpected files being committed during the release process
*******************
`;

/**
 * Exit release process when there are existing repo changes.
 *
 * This function is in charge of determining any pre-existing conditions that
 * could compromise a release and exiting the process if any are found.
 */
export const sanityCheck = (skipSanityCheck: boolean) => {
  if (skipSanityCheck) {
    console.log(SANITY_WARNING);

    // No matter what, we should always make sure the release has all latest changes.
    return assertBranchUpToDate;
  }

  return flow([assertCleanBranch, assertCorrectBranch, assertBranchUpToDate]);
};

const assertCleanBranch = async () => {
  const initFiles = await gitStatus();

  if (initFiles.length) {
    console.error(
      'There are existing changes in the repository. Please commit or stash them before attempting release.',
    );
    process.exit();
  }
};

const assertCorrectBranch = async () => {
  const currentBranch = await run('git rev-parse --abbrev-ref HEAD');

  if (currentBranch !== EXPECTED_BRANCH) {
    console.error(
      `
You are currently on the branch '${currentBranch}'.
A release can only be triggered from the branch '${EXPECTED_BRANCH}'.
`,
    );
    process.exit();
  }

  console.log('No pre-existing changes found. Proceeding...');
};

const assertBranchUpToDate = async () => {
  const branchUpToDate = await run('git pull');

  if (branchUpToDate !== 'Already up to date.') {
    console.log(`Latest changes from ${EXPECTED_BRANCH} pulled. Proceeding...`);
  }
};
