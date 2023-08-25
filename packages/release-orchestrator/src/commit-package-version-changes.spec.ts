import { expect, it, describe, afterEach, afterAll, vi } from 'vitest';
import { commitPackageVersionBumps } from './commit-package-version-changes';
import { gitCommitChanges } from './git-commit-changes';
import type { StatusProperty } from './types';

vi.mock('./git-commit-changes', async () => {
  return {
    gitCommitChanges: vi.fn(() => () => Promise.resolve()),
  };
});

vi.stubGlobal('process', {
  exit: vi.fn(),
});

describe('commitPackageVersionBumps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should not commit changes if skipGitOps is true', async () => {
    const skipGitOps = true;
    const statusProperty: StatusProperty = {
      _value: { changesets: [], releases: [] },
      value: { changesets: [], releases: [] },
    };

    await commitPackageVersionBumps(skipGitOps, statusProperty)();

    expect(gitCommitChanges).not.toHaveBeenCalled();
  });

  it('should commit changes if skipGitOps is false', async () => {
    const skipGitOps = false;
    const statusProperty: StatusProperty = {
      _value: {
        changesets: [],
        releases: [
          {
            name: 'package1',
            type: 'patch',
            oldVersion: '1.0.0',
            newVersion: '1.0.1',
          },
        ],
      },
      value: {
        changesets: [],
        releases: [
          {
            name: 'package1',
            type: 'patch',
            oldVersion: '1.0.0',
            newVersion: '1.0.1',
          },
        ],
      },
    };

    await commitPackageVersionBumps(skipGitOps, statusProperty)();

    expect(gitCommitChanges).toHaveBeenCalled();
    expect(gitCommitChanges).toHaveBeenCalledWith(expect.stringContaining('Release'), [
      './packages/*',
      '--update',
    ]);
  });
});
