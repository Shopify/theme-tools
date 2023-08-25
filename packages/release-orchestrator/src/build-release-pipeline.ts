import { patchBumpDependants } from './patch-bump-dependants';
import { locateAllPkgJsons } from './locate-all-package-jsons';
import { changesetVersion, changesetTag, changesetStatus } from './changeset';
import { gitCommitChanges } from './git-commit-changes';
import { finalMessaging, initialMessaging } from './messaging';
import { gitChangeBranch } from './git-change-branch';
import { getCurrentDateFormatted } from './get-current-date-formatted';
import { sanityCheck } from './sanity-check';
import { gitPushBranch } from './git-push-branch';
import type { StageFunction, ChangesetStatus, StatusProperty } from './types';
import { buildPackageJsonMap } from './build-package-json-map';

const identity = (x: any) => x;

/**
 * We need to persist the changeset status between multiple release pipeline stages.
 *
 * This info is used to generate the release PR markdown but lost as soon as `changeset version` is run.
 */
const statusProperty: StatusProperty = {
  _value: {} as ChangesetStatus,
  get value(): ChangesetStatus {
    return this._value;
  },
  set value(newValue: ChangesetStatus) {
    this._value = newValue;
  },
};

/**
 * Returns an array of functions to be executed in ascending order.
 */
export const buildReleasePipeline = (args: string[]) => {
  /**
   * The --no-sanity flag skips all prerequisite sanity checking before the release process
   * This is especially useful when developing changes to the
   * release-orchestrator within a branch other than main.
   */
  const skipSanityCheck = args.includes('--no-sanity');

  /**
   * The --no-git flag is meant to skip all parts of the release pipeline that changes something through git.
   * In development, this is useful when you want to run the release pipeline without committing anything.
   */
  const skipGitOps = args.includes('--no-git');

  const releaseBranchName = `release/${getCurrentDateFormatted()}`;

  const createReleaseBranch = skipGitOps ? identity : gitChangeBranch(releaseBranchName);

  const commitPatchChangesets = skipGitOps
    ? identity
    : gitCommitChanges('release: patch changelogs for dependent packages', ['.changeset/*']);

  const commitVersionBumps = skipGitOps
    ? identity
    : gitCommitChanges('release: bumped package versions for release', [
        './packages/*',
        '--update', // This flag includes modifications such as deletions. ie: `changeset version` deleting changelogs.
      ]);

  const setChangesetStatus = async () => {
    statusProperty.value = await changesetStatus();
  };

  const pushReleaseBranch = skipGitOps ? identity : gitPushBranch(releaseBranchName);

  return [
    sanityCheck(skipSanityCheck),
    initialMessaging,
    createReleaseBranch,
    locateAllPkgJsons,
    buildPackageJsonMap,
    patchBumpDependants,
    commitPatchChangesets,
    setChangesetStatus,
    changesetVersion,
    commitVersionBumps,
    changesetTag,
    pushReleaseBranch,
    finalMessaging(releaseBranchName, statusProperty),
  ] as StageFunction[];
};
