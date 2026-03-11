"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileExists = fileExists;
const promises_1 = __importDefault(require("node:fs/promises"));
async function fileExists(path) {
    try {
        await promises_1.default.stat(path);
        return true;
    }
    catch (e) {
        return false;
    }
}
//# sourceMappingURL=file-utils.js.map