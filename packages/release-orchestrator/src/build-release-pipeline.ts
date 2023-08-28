import { buildPackageJsonMap } from './build-package-json-map';
import { changesetStatus, changesetTag, changesetVersion } from './changeset';
import { commitPackageVersionBumps } from './commit-package-version-changes';
import { getCurrentDateFormatted } from './get-current-date-formatted';
import { gitChangeBranch } from './git-change-branch';
import { gitPushBranch } from './git-push-branch';
import { locateAllPkgJsons } from './locate-all-package-jsons';
import { finalMessaging, initialMessaging } from './messaging';
import { patchBumpDependants } from './patch-bump-dependants';
import { sanityCheck } from './sanity-check';
import type { ChangesetStatus, StageFunction, StatusProperty } from './types';

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

  const releaseBranchName = `release/${getCurrentDateFormatted()}`;

  const createReleaseBranch = gitChangeBranch(releaseBranchName);

  const setChangesetStatus = async () => {
    statusProperty.value = await changesetStatus();
  };

  const pushReleaseBranch = gitPushBranch(releaseBranchName);

  return [
    sanityCheck(skipSanityCheck),
    initialMessaging,
    createReleaseBranch,
    locateAllPkgJsons,
    buildPackageJsonMap,
    patchBumpDependants,
    setChangesetStatus,
    changesetVersion,
    commitPackageVersionBumps(statusProperty),
    changesetTag,
    pushReleaseBranch,
    finalMessaging(releaseBranchName, statusProperty),
  ] as StageFunction[];
};
