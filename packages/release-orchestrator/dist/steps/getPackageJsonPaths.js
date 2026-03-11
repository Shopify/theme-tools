"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPackageJsonPaths = getPackageJsonPaths;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
async function getPackageJsonPaths() {
    const pkgsRootDir = path_1.default.join(await (0, utils_1.getRepoRoot)(), 'packages');
    const packageJsonPaths = [];
    try {
        const files = await promises_1.default.readdir(pkgsRootDir, { withFileTypes: true });
        // Find the file paths for all package.json files within the packages directory
        for (const file of files) {
            // Check if the item is a directory
            if (file.isDirectory()) {
                // Construct package.json file path
                const packageJsonPath = path_1.default.join(pkgsRootDir, file.name, 'package.json');
                // Check if package.json file exists
                try {
                    await promises_1.default.access(packageJsonPath);
                    packageJsonPaths.push(packageJsonPath);
                }
                catch (error) {
                    // If the file doesn't exist, ignore the error and don't add the path to the array
                }
            }
        }
    }
    catch (err) {
        console.error('Unable to scan directory: ', err);
        process.exit(1);
    }
    return packageJsonPaths;
}
//# sourceMappingURL=getPackageJsonPaths.js.map