import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import { gitCommitChanges } from './git-commit-changes';
import { run } from './utils';
import { confirmProceed } from './confirm-proceed';

vi.mock('./utils', async () => ({
  run: vi.fn(() => ''),
}));

vi.stubGlobal('process', {
  exit: vi.fn(),
});

vi.mock('./confirm-proceed', async () => ({
  confirmProceed: vi.fn(),
}));

describe('gitCommitChanges', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should not commit changes when there are no staged changes', async () => {
    (run as Mock).mockResolvedValueOnce('');

    const commitChanges = gitCommitChanges('test message');
    await commitChanges();

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledWith('git add *');
    expect(run).toHaveBeenCalledWith('git diff --name-only --cached');
  });

  it('should commit changes when user confirms commit', async () => {
    (run as Mock).mockResolvedValue('somefile.js\nsomeOtherFile.js\n');
    (confirmProceed as Mock).mockResolvedValueOnce(true);

    const commitChanges = gitCommitChanges('test message');
    await commitChanges();

    expect(run).toHaveBeenCalledTimes(3);
    expect(run).toHaveBeenCalledWith('git add *');
    expect(run).toHaveBeenCalledWith('git commit -m "test message"');
    expect(run).toHaveBeenCalledWith('git diff --name-only --cached');
    expect(confirmProceed).toHaveBeenCalledTimes(1);
  });

  it('should not commit changes when user cancels commit', async () => {
    (run as Mock).mockResolvedValue('somefile.js\nsomeOtherFile.js\n');
    (confirmProceed as Mock).mockResolvedValueOnce(false);

    const commitChanges = gitCommitChanges('test message');
    await commitChanges();

    expect(run).toHaveBeenCalledTimes(3);
    expect(run).toHaveBeenCalledWith('git add *');
    expect(run).toHaveBeenCalledWith('git diff --name-only --cached');
    expect(run).toHaveBeenCalledWith('git restore --staged .');
    expect(confirmProceed).toHaveBeenCalledTimes(1);
  });
});
