"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findRoot = findRoot;
const path = __importStar(require("./path"));
async function isRoot(dir, fileExists) {
    return or(fileExists(path.join(dir, 'shopify.extension.toml')), // for theme-app-extensions
    fileExists(path.join(dir, '.theme-check.yml')), 
    // Maybe the root of the workspace has an assets + snippets directory, we'll accept that
    and(fileExists(path.join(dir, '.git')), fileExists(path.join(dir, 'assets')), fileExists(path.join(dir, 'snippets'))), 
    // zip files and TAEs might not have config files, but they should have an
    // assets & snippets directory but in case they do specify a .theme-check.yml a
    // couple of directories up, we should respect that
    and(fileExists(path.join(dir, 'assets')), fileExists(path.join(dir, 'snippets')), not(fileExists(path.join(path.dirname(dir), '.theme-check.yml'))), not(fileExists(path.join(path.dirname(path.dirname(dir)), '.theme-check.yml')))));
}
async function and(...promises) {
    const bools = await Promise.all(promises);
    return bools.reduce((a, b) => a && b, true);
}
async function or(...promises) {
    const bools = await Promise.all(promises);
    return bools.reduce((a, b) => a || b, false);
}
async function not(ap) {
    const a = await ap;
    return !a;
}
/**
 * Returns the "root" of a theme or theme app extension. The root is the
 * directory that contains a `.theme-check.yml` file, a `.git` directory, or a
 * `shopify.extension.toml` file.
 *
 * There are cases where .theme-check.yml is not defined and we have to infer the root.
 * We'll assume that the root is the directory that contains a `snippets` directory.
 *
 * So you can think of this function as the function that infers where a .theme-check.yml
 * should be.
 *
 * Note: that this is not the theme root. The config file might have a `root` entry in it
 * that points to somewhere else.
 */
async function findRoot(curr, fileExists) {
    const currIsRoot = await isRoot(curr, fileExists);
    if (currIsRoot) {
        return curr;
    }
    const dir = path.dirname(curr);
    const currIsAbsoluteRoot = dir === curr;
    if (currIsAbsoluteRoot) {
        return null; // Root not found.
    }
    return findRoot(dir, fileExists);
}
//# sourceMappingURL=find-root.js.map