import fs from 'fs/promises';
import path from 'path';

import { changesetStatus } from './changeset';
import { getRepoRoot } from './utils';

/**
 * Returns a string array of the file paths to all package.json files
 * that are immediate children within the packages directory
 */

const locateAllPkgJsons = async () => {
  const pkgsRootDir = path.join(await getRepoRoot(), 'packages');

  try {
    const files = await fs.readdir(pkgsRootDir, { withFileTypes: true });

    // Find the file paths for all package.json files within the packages directory
    const packageJsonPaths = await Promise.all(
      files.map(async (file) => {
        // Check if the item is a directory
        if (file.isDirectory()) {
          // Construct package.json file path
          const packageJsonPath = path.join(pkgsRootDir, file.name, 'package.json');

          // Check if package.json file exists
          try {
            await fs.access(packageJsonPath);
            return packageJsonPath;
          } catch (error) {
            // If the file doesn't exist, ignore the error and don't add the path to the array
            return null;
          }
        }
        return null;
      }),
    );

    // Filter out null values and return the packageJsonPaths
    return packageJsonPaths.filter(Boolean) as string[];
  } catch (err) {
    console.error('Unable to scan directory: ', err);
    process.exit(1);
  }
};

/**
 * Returns a list of all the package.json files updated by changeset and
 * another list of all the package.json files in our monorepo.
 */
export const locatePackageJsons = async () => {
  const [updated, all] = await Promise.all([changesetStatus(), locateAllPkgJsons()]);

  return { updated, all };
};
