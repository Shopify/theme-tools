"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeDependentPatchChangesets = void 0;
const changesetStatus_1 = require("./changesetStatus");
const generatePatchChangeset_1 = require("./generatePatchChangeset");
/**
 * Creates patch changesets for all packages that depend on the updated packages
 * but were not updated themselves.
 *
 * This will enable us to leverage `changeset version` to bump everything.
 */
const writeDependentPatchChangesets = async (packageJsonMap) => {
    let updated;
    let numPatches;
    do {
        /**
         * `changeset status` will return the latest status of every package included
         * in the next release based on all the changelogs available at the point of invocation.
         */
        updated = await (0, changesetStatus_1.changesetStatus)();
        numPatches = await generateDependentPatchChangesets({ updated, packageJsonMap });
    } while (
    /**
     * Until there are no more patches that can be applied to un-updated packages
     * we must keep evaluating whether more patches are needed.
     */
    numPatches > 0);
};
exports.writeDependentPatchChangesets = writeDependentPatchChangesets;
const generateDependentPatchChangesets = async ({ updated, packageJsonMap, }) => {
    const updatedPkgNames = updated.releases.map((release) => release.name);
    const pkgNamesToProcess = Object.keys(packageJsonMap).filter((pkgName) => !updatedPkgNames.includes(pkgName));
    let numPatches = 0;
    const patchPromises = pkgNamesToProcess.map((pkgName) => {
        const packageJson = packageJsonMap[pkgName];
        // Check the package's dependencies for any updated package names
        const updatedDeps = packageJson.dependencies
            ? Object.keys(packageJson.dependencies).filter((dep) => updatedPkgNames.includes(dep))
            : [];
        if (updatedDeps.length) {
            numPatches++;
            return (0, generatePatchChangeset_1.generatePatchChangeset)(packageJson.name, updatedDeps);
        }
    });
    await Promise.all(patchPromises);
    return numPatches;
};
//# sourceMappingURL=writeDependentPatchChangesets.js.map