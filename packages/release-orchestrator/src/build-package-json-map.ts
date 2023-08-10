import fs from 'fs';
import { promisify } from 'node:util';

import type { PackageJson, PackageJsonMap } from './types';

const readFile = promisify(fs.readFile);

/**
 * Reads a list of package.json files and builds a map with package names as keys and
 * package.json content as values.
 */
export const buildPackageJsonMap = async (packageJsonPaths: string[]): Promise<PackageJsonMap> => {
  // Start reading and parsing all package json files
  const jsonDataPromises = packageJsonPaths.map(async (packageJsonPath) => {
    try {
      const rawData = await readFile(packageJsonPath, 'utf-8');
      const jsonData: PackageJson = JSON.parse(rawData);
      return jsonData;
    } catch (error) {
      console.error(`Error reading or parsing package.json file at ${packageJsonPath}:`, error);
      return null;
    }
  });

  // Wait for all files to be read and parsed
  const jsonDataArray = await Promise.all(jsonDataPromises);

  // Reduce the array to the desired object
  const packageJsonMap = jsonDataArray.reduce<{ [key: string]: PackageJson }>((acc, jsonData) => {
    if (jsonData) {
      acc[jsonData.name] = jsonData;
    }
    return acc;
  }, {});

  return packageJsonMap;
};
