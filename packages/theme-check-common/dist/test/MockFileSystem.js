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
exports.MockFileSystem = void 0;
const AbstractFileSystem_1 = require("../AbstractFileSystem");
const utils_1 = require("../utils");
const path_1 = require("../path");
const path = __importStar(require("../path"));
class MockFileSystem {
    constructor(mockTheme, rootUri = 'file:///') {
        this.mockTheme = mockTheme;
        this.rootUri = (0, path_1.normalize)(rootUri);
    }
    async readFile(uri) {
        const relativePath = this.rootRelative(uri);
        if (this.mockTheme[relativePath] === undefined) {
            throw new Error('File not found');
        }
        else {
            return this.mockTheme[relativePath];
        }
    }
    async readDirectory(uri) {
        // eslint-disable-next-line no-param-reassign
        uri = uri.replace(/\/$/, '');
        const relativePath = this.rootRelative(uri);
        const tree = path.normalize(uri) === this.rootUri
            ? this.fileTree
            : (0, utils_1.deepGet)(this.fileTree, relativePath.split('/'));
        if (tree === undefined || tree === null) {
            throw new Error(`Directory not found: ${uri} for ${this.rootUri}`);
        }
        if (typeof tree === 'string') {
            return [[uri, AbstractFileSystem_1.FileType.File]];
        }
        return Object.entries(tree).map(([fileName, value]) => {
            return [`${uri}/${fileName}`, typeof value === 'string' ? AbstractFileSystem_1.FileType.File : AbstractFileSystem_1.FileType.Directory];
        });
    }
    async stat(uri) {
        var _a;
        const relativePath = this.rootRelative(uri);
        const source = this.mockTheme[relativePath];
        if (source) {
            return {
                type: AbstractFileSystem_1.FileType.File,
                size: (_a = source.length) !== null && _a !== void 0 ? _a : 0,
            };
        }
        const readdirResult = await this.readDirectory(uri);
        if (readdirResult) {
            return {
                type: AbstractFileSystem_1.FileType.Directory,
                size: 0, // Size is not applicable for directories
            };
        }
        throw new Error(`File not found: ${uri} for ${this.rootUri}`);
    }
    get fileTree() {
        var _a;
        const result = {};
        for (const [relativePath, source] of Object.entries(this.mockTheme)) {
            const segments = relativePath.split('/');
            let current = result;
            for (let i = 0; i < segments.length - 1; i++) {
                const segment = segments[i];
                (_a = current[segment]) !== null && _a !== void 0 ? _a : (current[segment] = {});
                current = current[segment];
            }
            current[segments[segments.length - 1]] = source;
        }
        return result;
    }
    rootRelative(uri) {
        return (0, path_1.relative)((0, path_1.normalize)(uri), this.rootUri);
    }
}
exports.MockFileSystem = MockFileSystem;
//# sourceMappingURL=MockFileSystem.js.map