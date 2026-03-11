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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockNodeModuleCheck = void 0;
exports.makeTmpFolder = makeTmpFolder;
exports.removeTmpFolder = removeTmpFolder;
exports.createMockConfigFile = createMockConfigFile;
exports.createMockNodeModule = createMockNodeModule;
exports.makeTempWorkspace = makeTempWorkspace;
const mktemp = __importStar(require("mktemp"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const theme_check_common_1 = require("@shopify/theme-check-common");
async function makeTmpFolder() {
    const tmpDir = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'test-'));
    await promises_1.default.mkdir(node_path_1.default.join(tmpDir, '.git'));
    return tmpDir;
}
async function removeTmpFolder(tempDir) {
    return promises_1.default.rm(tempDir, { recursive: true, force: true });
}
async function createMockConfigFile(tempDir, contents = 'dummy content', relativePath = '.theme-check.yml') {
    const filePath = node_path_1.default.join(tempDir, relativePath);
    await promises_1.default.writeFile(filePath, contents, 'utf8');
    return filePath;
}
exports.mockNodeModuleCheck = `
  const NodeModuleCheck = {
    meta: {
      name: 'NodeModuleCheck',
      code: 'NodeModuleCheck',
      docs: { description: '...' },
      schema: {},
      severity: 0,
      targets: [],
      type: 'LiquidHtml',
    },
    create() {
      return {};
    },
  };

  exports.checks = [
    NodeModuleCheck,
  ];
`;
async function createMockNodeModule(tempDir, moduleName, moduleContent = exports.mockNodeModuleCheck) {
    const nodeModuleRoot = node_path_1.default.join(tempDir, 'node_modules', ...moduleName.split('/'));
    await promises_1.default.mkdir(nodeModuleRoot, { recursive: true });
    await promises_1.default.writeFile(node_path_1.default.join(nodeModuleRoot, 'package.json'), JSON.stringify({
        name: moduleName,
        main: './index.js',
    }), 'utf8');
    await promises_1.default.writeFile(node_path_1.default.join(nodeModuleRoot, 'index.js'), moduleContent);
    return nodeModuleRoot;
}
async function makeTempWorkspace(structure) {
    const root = await mktemp.createDir(node_path_1.default.join(__dirname, '..', '.XXXXX'));
    if (!root)
        throw new Error('Could not create temp dir for temp workspace');
    await createFiles(structure, [root]);
    const rootUri = theme_check_common_1.path.normalize('file:' + root);
    return {
        rootUri: 'file:' + root,
        uri: (relativePath) => theme_check_common_1.path.join(rootUri, ...relativePath.split('/')),
        clean: async () => promises_1.default.rm(root, { recursive: true, force: true }),
    };
    function createFiles(tree, ancestors) {
        const promises = [];
        for (const [pathEl, value] of Object.entries(tree)) {
            if (typeof value === 'string') {
                promises.push(promises_1.default.writeFile(node_path_1.default.join(...ancestors, pathEl), value, 'utf8'));
            }
            else {
                promises.push(promises_1.default
                    .mkdir(node_path_1.default.join(...ancestors, pathEl))
                    .then(() => createFiles(value, ancestors.concat(pathEl))));
            }
        }
        return Promise.all(promises);
    }
}
//# sourceMappingURL=test-helpers.js.map