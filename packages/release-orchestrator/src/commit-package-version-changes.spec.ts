import { expect, it, describe, afterEach, afterAll, vi } from 'vitest';
import { commitPackageVersionBumps } from './commit-package-version-changes';
import { gitCommitChanges } from './git-commit-changes';
import type { StatusProperty } from './types';

vi.mock('./git-commit-changes', async () => {
  return {
    gitCommitChanges: vi.fn(() => () => Promise.resolve()),
  };
});

describe('commitPackageVersionBumps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should commit changes', async () => {
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

    await commitPackageVersionBumps(statusProperty)();

    expect(gitCommitChanges).toHaveBeenCalled();
    expect(gitCommitChanges).toHaveBeenCalledWith(expect.stringContaining('Release'), [
      './packages/*',
      '--update',
    ]);
  });
});
