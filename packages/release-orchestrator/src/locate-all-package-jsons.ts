import fs from 'fs/promises';
import path from 'path';

import { getRepoRoot } from './utils';

/**
 * Returns an object map of all package.json file contents to their package names.
 *
 * This only looks at immediate children package.json's within the packages directory
 */
export const locateAllPkgJsons = async () => {
  const pkgsRootDir = path.join(await getRepoRoot(), 'packages');

  const packageJsonPaths: string[] = [];

  try {
    const files = await fs.readdir(pkgsRootDir, { withFileTypes: true });

    // Find the file paths for all package.json files within the packages directory
    for (const file of files) {
      // Check if the item is a directory
      if (file.isDirectory()) {
        // Construct package.json file path
        const packageJsonPath = path.join(pkgsRootDir, file.name, 'package.json');

        // Check if package.json file exists
        try {
          await fs.access(packageJsonPath);
          packageJsonPaths.push(packageJsonPath);
        } catch (error) {
          // If the file doesn't exist, ignore the error and don't add the path to the array
        }
      }
    }
  } catch (err) {
    console.error('Unable to scan directory: ', err);
    process.exit(1);
  }
  return packageJsonPaths;
};
