import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { generatePatchChangeset } from './generate-patch-changeset';
import { getRepoRoot } from './utils';

// Need to do this for stupid windows paths
const repoPathTokens = ['path', 'to', 'repo'];
const expectedRepoPath = path.join(...repoPathTokens); // path.join gives windows friendly pathing

// Regex paths are for verifying paths in a cross-platform way
const pathSeparatorToken = '[\\\\//]';
const changesetPathRegex = new RegExp(
  pathSeparatorToken + ['path', 'to', 'repo', '.changeset'].join(pathSeparatorToken),
);
const changelogPathRegex = new RegExp(
  pathSeparatorToken + ['path', 'to', 'repo', '.changeset', '123456.md'].join(pathSeparatorToken),
);

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

    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringMatching(changesetPathRegex), {
      recursive: true,
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(changelogPathRegex),
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

    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringMatching(changesetPathRegex), {
      recursive: true,
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(changelogPathRegex),
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
