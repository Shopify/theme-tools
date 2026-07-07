import path from 'path';
import { afterAll, afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { getRepoRoot, readFile, run } from '../utils';
import { changesetStatus } from './changesetStatus';
import { changesetTag } from './changesetTag';
import { changesetVersion } from './changesetVersion';

vi.mock('../utils', async () => ({
  getRepoRoot: vi.fn(),
  readFile: vi.fn(),
  run: vi.fn(),
  memoize: vi.fn((fn) => fn),
}));

vi.stubGlobal('console', {
  log: vi.fn(),
});

describe('changeset', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('changesetTag should call run with correct arguments', async () => {
    (run as Mock).mockResolvedValueOnce('test output');

    await changesetTag();

    expect(run).toHaveBeenCalledWith('pnpm exec changeset tag');
    expect(console.log).toHaveBeenCalledWith('Creating git tags for package versions...');
    expect(console.log).toHaveBeenCalledWith('test output');
  });

  it('changesetVersion should call run with correct arguments', async () => {
    (run as Mock)
      .mockResolvedValueOnce('changeset version output')
      .mockResolvedValueOnce('lockfile output');

    await changesetVersion();

    expect(run).toHaveBeenCalledWith('pnpm exec changeset version');
    expect(run).toHaveBeenCalledWith('pnpm install --lockfile-only');
    expect(console.log).toHaveBeenCalledWith('Running `changeset version`...');
    expect(console.log).toHaveBeenCalledWith('changeset version output');
    expect(console.log).toHaveBeenCalledWith('Updating `pnpm-lock.yaml`...');
    expect(console.log).toHaveBeenCalledWith('lockfile output');
  });

  it('changesetStatus should call run with correct arguments and return changeset status', async () => {
    (run as Mock).mockResolvedValueOnce('test output');
    (getRepoRoot as Mock).mockResolvedValueOnce('/path/to/repo');
    (readFile as Mock).mockResolvedValueOnce(
      JSON.stringify({ releasedPackages: ['package1', 'package2'] }),
    );

    const result = await changesetStatus();
    const expectedStatusPath = path.join('/path', 'to', 'repo', 'changeset-status.json');

    expect(run).toHaveBeenCalledWith('pnpm exec changeset status --output=changeset-status.json');
    expect(run).toHaveBeenCalledWith(`rm ${expectedStatusPath}`);
    expect(readFile).toHaveBeenCalledWith(`${expectedStatusPath}`, 'utf-8');
    expect(result).toEqual({ releasedPackages: ['package1', 'package2'] });
  });
});
