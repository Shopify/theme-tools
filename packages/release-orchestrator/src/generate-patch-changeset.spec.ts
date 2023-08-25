import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { generatePatchChangeset } from './generate-patch-changeset';
import { getRepoRoot } from './utils';

// Need to do this for stupid windows paths
const expectedChangelogPath = path.join('/path', 'to', 'repo', '.changeset', '123456.md');
const expectedChangesetPath = path.join('/path', 'to', 'repo', '.changeset');
const expectedRepoPath = path.join('/path', 'to', 'repo');

vi.mock('./utils', async () => ({
  getRepoRoot: vi.fn(),
}));

vi.mock('crypto', async () => ({
  default: { randomBytes: vi.fn() },
}));

vi.mock('fs/promises', async () => ({
  default: { mkdir: vi.fn(), writeFile: vi.fn() },
}));

describe('generatePatchChangeset', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should generate a patch changeset for a package with single dependency', async () => {
    (getRepoRoot as Mock).mockResolvedValueOnce(expectedRepoPath);
    (crypto.randomBytes as Mock).mockReturnValueOnce({ toString: () => '123456' });

    await generatePatchChangeset('package1', ['dependency1']);

    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringMatching(expectedChangesetPath), {
      recursive: true,
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedChangelogPath,
      `---
"package1": patch
---

Patch bump because it depends on dependency1
`,
    );
  });

  it('should generate a patch changeset for a package with multiple dependencies', async () => {
    (getRepoRoot as Mock).mockResolvedValueOnce(expectedRepoPath);
    (crypto.randomBytes as Mock).mockReturnValueOnce({ toString: () => '123456' });

    await generatePatchChangeset('package1', ['dependency1', 'dependency2']);

    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringMatching(expectedChangesetPath), {
      recursive: true,
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedChangelogPath,
      `---
"package1": patch
---

Patch bump because it depends on:
 - dependency1
 - dependency2
`,
    );
  });
});
