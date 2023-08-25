import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import { gitChangeBranch } from './git-change-branch';
import { confirmProceed } from './confirm-proceed';
import { run } from './utils';

vi.mock('./confirm-proceed', async () => ({
  confirmProceed: vi.fn(),
}));

vi.mock('./utils', async () => ({
  run: vi.fn(() => ''),
}));

vi.stubGlobal('process', {
  exit: vi.fn(),
});

describe('gitChangeBranch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should not change branch if user does not confirm', async () => {
    (confirmProceed as Mock).mockResolvedValueOnce(false);

    await gitChangeBranch('test-branch')();

    expect(confirmProceed).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalled();
  });

  it('should change branch if user confirms and branch does not exist', async () => {
    (confirmProceed as Mock).mockResolvedValueOnce(true);
    (run as Mock).mockResolvedValueOnce('');

    await gitChangeBranch('test-branch')();

    expect(confirmProceed).toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith('git checkout -B test-branch');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should not change branch if user confirms but branch already exists', async () => {
    (confirmProceed as Mock).mockResolvedValueOnce(true);
    (run as Mock).mockResolvedValueOnce(`fatal: a branch named 'test-branch' already exists`);

    await gitChangeBranch('test-branch')();

    expect(confirmProceed).toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith('git checkout -B test-branch');
    expect(process.exit).toHaveBeenCalled();
  });
});
