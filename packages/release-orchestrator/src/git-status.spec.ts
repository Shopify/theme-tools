import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import { gitStatus } from './git-status';
import { run } from './utils';

vi.mock('./utils', async () => ({
  run: vi.fn(),
}));

describe('gitStatus', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should return an array of file statuses', async () => {
    (run as Mock).mockResolvedValueOnce('M file1.txt\nA file2.txt\nD file3.txt');

    const result = await gitStatus();

    expect(run).toHaveBeenCalledWith('git status --porcelain');
    expect(result).toEqual([
      { status: 'M', filepath: 'file1.txt' },
      { status: 'A', filepath: 'file2.txt' },
      { status: 'D', filepath: 'file3.txt' },
    ]);
  });

  it('should return an empty array if git status output is empty', async () => {
    (run as Mock).mockResolvedValueOnce('');

    const result = await gitStatus();

    expect(run).toHaveBeenCalledWith('git status --porcelain');
    expect(result).toEqual([]);
  });
});
