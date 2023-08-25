import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import { buildReleasePipeline } from './build-release-pipeline';
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

vi.mock('./build-package-json-map', async () => ({
  buildPackageJsonMap: vi.fn(),
}));

vi.mock('./changeset', async () => ({
  changesetStatus: vi.fn(),
  changesetTag: vi.fn(),
  changesetVersion: vi.fn(),
}));

vi.mock('./commit-package-version-changes', async () => ({
  commitPackageVersionBumps: vi.fn(),
}));

vi.mock('./get-current-date-formatted', async () => ({
  getCurrentDateFormatted: vi.fn(),
}));

vi.mock('./git-change-branch', async () => ({
  gitChangeBranch: vi.fn(),
}));

vi.mock('./git-push-branch', async () => ({
  gitPushBranch: vi.fn(),
}));

vi.mock('./locate-all-package-jsons', async () => ({
  locateAllPkgJsons: vi.fn(),
}));

vi.mock('./messaging', async () => ({
  finalMessaging: vi.fn(),
  initialMessaging: vi.fn(),
}));

vi.mock('./patch-bump-dependants', async () => ({
  patchBumpDependants: vi.fn(),
}));

vi.mock('./sanity-check', async () => ({
  sanityCheck: vi.fn(),
}));

describe('buildReleasePipeline', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should return an array of functions to be executed in ascending order', async () => {
    (getCurrentDateFormatted as Mock).mockReturnValueOnce('2022-01-01');

    const result = buildReleasePipeline([]);

    expect(result).toEqual([
      sanityCheck(false),
      initialMessaging,
      gitChangeBranch('release/2022-01-01'),
      locateAllPkgJsons,
      buildPackageJsonMap,
      patchBumpDependants,
      expect.any(Function), // setChangesetStatus
      changesetVersion,
      commitPackageVersionBumps(false, expect.any(Object)), // statusProperty
      changesetTag,
      gitPushBranch('release/2022-01-01'),
      finalMessaging('release/2022-01-01', expect.any(Object)), // statusProperty
    ]);
  });

  it('should return an array of functions with skipped stages if --no-sanity and --no-git flags are present', async () => {
    const result = buildReleasePipeline(['--no-sanity', '--no-git']);

    expect(result).toEqual([
      sanityCheck(true),
      initialMessaging,
      expect.any(Function), // identity
      locateAllPkgJsons,
      buildPackageJsonMap,
      patchBumpDependants,
      expect.any(Function), // setChangesetStatus
      changesetVersion,
      commitPackageVersionBumps(true, expect.any(Object)), // statusProperty
      changesetTag,
      expect.any(Function), // identity
      finalMessaging('', expect.any(Object)), // statusProperty
    ]);
  });
});
