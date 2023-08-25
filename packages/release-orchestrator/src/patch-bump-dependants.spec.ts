import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import { patchBumpDependants } from './patch-bump-dependants';
import { changesetStatus } from './changeset';
import { generatePatchChangeset } from './generate-patch-changeset';

vi.mock('./changeset', async () => ({
  changesetStatus: vi.fn(),
}));

vi.mock('./generate-patch-changeset', async () => ({
  generatePatchChangeset: vi.fn(),
}));

describe('patchBumpDependants', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should apply patch bumps to dependants of updated packages', async () => {
    const packageJsonMap = {
      package1: { name: 'package1', dependencies: { package2: '^1.0.0' } },
      package2: { name: 'package2', dependencies: {} },
    };
    (changesetStatus as Mock).mockResolvedValueOnce({
      releases: [{ name: 'package2', type: 'patch', oldVersion: '1.0.0', newVersion: '1.0.1' }],
      changesets: [],
    });
    (changesetStatus as Mock).mockResolvedValueOnce({
      releases: [
        { name: 'package1', type: 'patch', oldVersion: '1.0.0', newVersion: '1.0.1' },
        { name: 'package2', type: 'patch', oldVersion: '1.0.1', newVersion: '1.0.2' },
      ],
      changesets: [],
    });

    await patchBumpDependants(packageJsonMap);

    expect(changesetStatus).toHaveBeenCalledTimes(2);
    expect(generatePatchChangeset).toHaveBeenCalledWith('package1', ['package2']);
  });

  it('should not apply patch bumps to dependants if there are no updated packages', async () => {
    const packageJsonMap = {
      package1: { name: 'package1', dependencies: { package2: '^1.0.0' } },
      package2: { name: 'package2', dependencies: {} },
    };
    (changesetStatus as Mock).mockResolvedValueOnce({
      releases: [],
      changesets: [],
    });

    await patchBumpDependants(packageJsonMap);

    expect(changesetStatus).toHaveBeenCalledTimes(1);
    expect(generatePatchChangeset).not.toHaveBeenCalled();
  });
});
