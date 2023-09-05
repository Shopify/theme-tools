import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import { gitPushBranch } from './git-push-branch';
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

describe('gitPushBranch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should not push branch if user does not confirm', async () => {
    (confirmProceed as Mock).mockResolvedValueOnce(false);

    await gitPushBranch('test-branch')();

    expect(confirmProceed).toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalled();
  });

  it('should push branch if user confirms', async () => {
    (confirmProceed as Mock).mockResolvedValueOnce(true);

    await gitPushBranch('test-branch')();

    expect(confirmProceed).toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith('git push --force --tags origin test-branch');
    expect(process.exit).not.toHaveBeenCalled();
  });
});
