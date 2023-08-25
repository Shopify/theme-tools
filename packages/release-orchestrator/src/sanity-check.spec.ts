import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import { sanityCheck } from './sanity-check';
import { gitStatus } from './git-status';
import { run } from './utils';

vi.mock('./git-status', async () => ({
  gitStatus: vi.fn(),
}));

vi.mock('./utils', async () => ({
  run: vi.fn(),
}));

vi.stubGlobal('console', {
  log: vi.fn(),
  error: vi.fn(),
});

vi.stubGlobal('process', {
  exit: vi.fn(),
});

describe('sanityCheck', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should skip sanity checks if skipSanityCheck is true', async () => {
    const check = sanityCheck(true);

    await check();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipping sanity checks'));
    expect(gitStatus).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should exit process if there are existing changes in the repository', async () => {
    (gitStatus as Mock).mockResolvedValueOnce([{ status: 'M', filepath: 'file1.txt' }]);
    const check = sanityCheck(false);

    await check();

    expect(console.error).toHaveBeenCalledWith(
      'There are existing changes in the repository. Please commit or stash them before attempting release.',
    );
    expect(process.exit).toHaveBeenCalledWith();
  });

  it('should exit process if current branch is not main', async () => {
    (gitStatus as Mock).mockResolvedValueOnce([]);
    (run as Mock).mockResolvedValueOnce('dev');
    const check = sanityCheck(false);

    await check();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('A release can only be triggered from the branch'),
    );
    expect(process.exit).toHaveBeenCalledWith();
  });

  it('should proceed if there are no pre-existing changes and current branch is main', async () => {
    (gitStatus as Mock).mockResolvedValueOnce([]);
    (run as Mock).mockResolvedValueOnce('main');
    const check = sanityCheck(false);

    await check();

    expect(console.log).toHaveBeenCalledWith('No pre-existing changes found. Proceeding...');
    expect(process.exit).not.toHaveBeenCalled();
  });
});
