import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { getRepoRoot } from './utils';

/**
 * Generate a patch changeset for a package.
 *
 * This is a workaround because we cannot use `changeset add` programmatically.
 *
 */
export const generatePatchChangeset = async (pkgName: string, updatedDeps: string[]) => {
  const changesetId = crypto.randomBytes(6).toString('hex');
  const changesetDir = path.resolve(await getRepoRoot(), '.changeset');
  const changesetPath = path.join(changesetDir, `${changesetId}.md`);

  const depsDescription =
    updatedDeps.length === 1 ? ` ${updatedDeps[0]}` : `:\n - ${updatedDeps.join('\n - ')}`;

  const changesetContent = `---
"${pkgName}": patch
---

Patch bump because it depends on${depsDescription}
`;

  await fs.mkdir(changesetDir, { recursive: true });
  await fs.writeFile(changesetPath, changesetContent);
};
