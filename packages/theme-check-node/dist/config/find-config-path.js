"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findConfigPath = findConfigPath;
const node_path_1 = __importDefault(require("node:path"));
const file_utils_1 = require("../file-utils");
const DiscoverableConfigFileNames = ['.theme-check.yml'];
function findConfigPath(root) {
    const paths = DiscoverableConfigFileNames.map((file) => node_path_1.default.join(root, file));
    return find(paths, file_utils_1.fileExists);
}
async function find(array, pred) {
    for (const el of array) {
        if (await pred(el)) {
            return el;
        }
    }
    return undefined;
}
//# sourceMappingURL=find-config-path.js.map