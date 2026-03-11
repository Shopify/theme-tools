import type { PackageJsonRecord } from '../types';
/**
 * Creates patch changesets for all packages that depend on the updated packages
 * but were not updated themselves.
 *
 * This will enable us to leverage `changeset version` to bump everything.
 */
export declare const writeDependentPatchChangesets: (packageJsonMap: PackageJsonRecord) => Promise<void>;
