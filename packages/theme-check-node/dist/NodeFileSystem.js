"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFileSystem = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const promises_1 = __importDefault(require("node:fs/promises"));
exports.NodeFileSystem = {
    async readFile(uri) {
        // I'm intentionally leaving these comments here for debugging purposes :)
        // console.error('fs/readFile', uri);
        return promises_1.default.readFile(theme_check_common_1.path.fsPath(uri), 'utf8');
    },
    async readDirectory(uri) {
        // console.error('fs/readDirectory', uri);
        const files = await promises_1.default.readdir(theme_check_common_1.path.fsPath(uri), { withFileTypes: true });
        return files.map((file) => {
            return [theme_check_common_1.path.join(uri, file.name), file.isDirectory() ? theme_check_common_1.FileType.Directory : theme_check_common_1.FileType.File];
        });
    },
    async stat(uri) {
        // console.error('fs/stat', uri);
        try {
            const stats = await promises_1.default.stat(theme_check_common_1.path.fsPath(uri));
            return {
                type: stats.isDirectory() ? theme_check_common_1.FileType.Directory : theme_check_common_1.FileType.File,
                size: stats.size,
            };
        }
        catch (e) {
            throw new Error(`Failed to get file stat: ${e}`);
        }
    },
};
//# sourceMappingURL=NodeFileSystem.js.map