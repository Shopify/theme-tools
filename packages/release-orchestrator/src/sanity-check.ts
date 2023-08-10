import { gitStatus, run } from './utils';

const EXPECTED_BRANCH = 'main';

/**
 * Exit release process when there are existing repo changes.
 *
 * This function is in charge of determining any pre-existing conditions that
 * could compromise a release and exiting the process if any are found.
 */
export const sanityCheck = (skipSanityCheck: boolean) => async () => {
  if (skipSanityCheck) {
    console.log(`
*******************
WARNING: Skipping sanity checks is not recommended for production releases.
This can result in unexpected files being committed during the release process
*******************
`);

    return;
  }

  const initFiles = await gitStatus();

  if (initFiles.length) {
    console.error(
      'There are existing changes in the repository. Please commit or stash them before attempting release.',
    );
    process.exit();
  }

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
