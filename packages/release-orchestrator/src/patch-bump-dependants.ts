import fs from 'fs';

import type { ChangesetStatus } from './types';
import { generatePatchChangeset } from './generate-patch-changeset';

/**
 * Creates patch changelogs for all packages that depend on the
 * updated packages but were not updated themselves.
 *
 * This will enable us to leverage `changeset version` to bump everything.
 */
export const patchBumpDependants = async ({
  updated,
  all,
}: {
  updated: ChangesetStatus;
  all: string[];
}) => {
  const updatedPkgNames = updated.releases.map((release) => release.name);

  const patchPromises: Promise<any>[] = [];

  all.forEach((packageJsonPath) => {
    // TODO: may need try/catch here to fail fast when a package.json is syntactically borked
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    /**
     * Only need to bump the patch version when both:
     * - package was not updated by changeset. This updates package version and mono-repo dependencies.
     * - package uses one of the updated package names
     */
    const isPkgUpdated = updatedPkgNames.includes(packageJson.name);

    if (!isPkgUpdated) {
      // Check the package's dependencies for any updated package names
      const updatedDeps = packageJson.dependencies
        ? Object.keys(packageJson.dependencies).filter((dep) => updatedPkgNames.includes(dep))
        : [];

      if (updatedDeps.length) {
        patchPromises.push(generatePatchChangeset(packageJson.name, updatedDeps));
      }
    }
  });

  return Promise.all(patchPromises);
};
