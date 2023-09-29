import { Mock, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { buildPackageJsonMap } from './build-package-json-map';
import { buildReleasePipeline } from './build-release-pipeline';
import { changesetTag, changesetVersion } from './changeset';
import { getCurrentDateFormatted } from './get-current-date-formatted';
import { gitChangeBranch } from './git-change-branch';
import { gitPushBranch } from './git-push-branch';
import { locateAllPkgJsons } from './locate-all-package-jsons';
import { initialMessaging } from './messaging';
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
  commitPackageVersionBumps: vi.fn(() => vi.fn()),
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
  finalMessaging: vi.fn(() => vi.fn()),
  initialMessaging: vi.fn(),
}));

vi.mock('./patch-bump-dependants', async () => ({
  patchBumpDependants: vi.fn(),
}));

vi.mock('./sanity-check', async () => ({
  sanityCheck: vi.fn((skip) => skip),
}));

describe('buildReleasePipeline', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return an array of functions to be executed in ascending order', () => {
    (getCurrentDateFormatted as Mock).mockReturnValueOnce('2022-01-01');
    const pipeline = buildReleasePipeline([]);

    expect(pipeline).toHaveLength(11);
    expect(pipeline[0]).toBe(sanityCheck(false));
    expect(pipeline[1]).toBe(initialMessaging);
    expect(pipeline[2]).toBe(gitChangeBranch('release/2022-01-01'));
    expect(pipeline[3]).toBe(locateAllPkgJsons);
    expect(pipeline[4]).toBe(buildPackageJsonMap);
    expect(pipeline[5]).toBe(patchBumpDependants);
    expect(pipeline[6]).toBeInstanceOf(Function); // setChangesetStatus
    expect(pipeline[7]).toBe(changesetVersion);
    expect(pipeline[8]).toBeInstanceOf(Function); // commitPackageVersionBumps
    expect(pipeline[9]).toBe(gitPushBranch('release/2022-01-01'));
    expect(pipeline[10]).toBeInstanceOf(Function); // finalMessaging
  });

  it('should skip sanity checks if --no-sanity flag is present', () => {
    (getCurrentDateFormatted as Mock).mockReturnValueOnce('2022-01-01');
    const pipeline = buildReleasePipeline(['--no-sanity']);

    expect(pipeline[0]).toBe(sanityCheck(true));
  });
});
