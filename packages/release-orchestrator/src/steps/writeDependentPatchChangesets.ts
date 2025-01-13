import { changesetStatus } from './changesetStatus';
import { generatePatchChangeset } from './generatePatchChangeset';
import type { ChangesetStatus, PackageJsonRecord } from '../types';

/**
 * Creates patch changesets for all packages that depend on the updated packages
 * but were not updated themselves.
 *
 * This will enable us to leverage `changeset version` to bump everything.
 */
export const writeDependentPatchChangesets = async (packageJsonMap: PackageJsonRecord) => {
  let updated: ChangesetStatus | undefined;
  let numPatches: number;

  do {
    /**
     * `changeset status` will return the latest status of every package included
     * in the next release based on all the changelogs available at the point of invocation.
     */
    updated = await changesetStatus();
    numPatches = await generateDependentPatchChangesets({ updated, packageJsonMap });
  } while (
    /**
     * Until there are no more patches that can be applied to un-updated packages
     * we must keep evaluating whether more patches are needed.
     */
    numPatches > 0
  );
};

const generateDependentPatchChangesets = async ({
  updated,
  packageJsonMap,
}: {
  updated: ChangesetStatus;
  packageJsonMap: PackageJsonRecord;
}): Promise<number> => {
  const updatedPkgNames = updated.releases.map((release: any) => release.name);

  const pkgNamesToProcess = Object.keys(packageJsonMap).filter(
    (pkgName) => !updatedPkgNames.includes(pkgName),
  );

  let numPatches = 0;
  const patchPromises = pkgNamesToProcess.map((pkgName) => {
    const packageJson = packageJsonMap[pkgName];

    // Check the package's dependencies for any updated package names
    const updatedDeps = packageJson.dependencies
      ? Object.keys(packageJson.dependencies).filter((dep) => updatedPkgNames.includes(dep))
      : [];

    if (updatedDeps.length) {
      numPatches++;
      return generatePatchChangeset(packageJson.name, updatedDeps);
    }
  });

  await Promise.all(patchPromises);

  return numPatches;
};
