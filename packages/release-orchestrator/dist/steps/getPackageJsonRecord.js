"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPackageJsonRecord = void 0;
const utils_1 = require("../utils");
/**
 * Reads a list of package.json files and builds a Record<PackageName, PackageJson>.
 */
const getPackageJsonRecord = async (packageJsonPaths) => {
    // Start reading and parsing all package json files
    const jsonDataPromises = packageJsonPaths.map(async (packageJsonPath) => {
        try {
            const rawData = await (0, utils_1.readFile)(packageJsonPath, 'utf-8');
            const jsonData = JSON.parse(rawData);
            return jsonData;
        }
        catch (error) {
            console.error(`Error reading or parsing package.json file at ${packageJsonPath}:`, error);
            return null;
        }
    });
    // Wait for all files to be read and parsed
    const jsonDataArray = await Promise.all(jsonDataPromises);
    // Reduce the array to the desired object
    const packageJsonMap = jsonDataArray.reduce((acc, jsonData) => {
        if (jsonData) {
            acc[jsonData.name] = jsonData;
        }
        return acc;
    }, {});
    return packageJsonMap;
};
exports.getPackageJsonRecord = getPackageJsonRecord;
//# sourceMappingURL=getPackageJsonRecord.js.map