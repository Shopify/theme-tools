import type { PackageJsonRecord } from '../types';
/**
 * Reads a list of package.json files and builds a Record<PackageName, PackageJson>.
 */
export declare const getPackageJsonRecord: (packageJsonPaths: string[]) => Promise<PackageJsonRecord>;
