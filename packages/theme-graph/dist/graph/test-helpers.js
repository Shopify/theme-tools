"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skeleton = exports.fixturesRoot = void 0;
exports.makeGetSourceCode = makeGetSourceCode;
exports.getDependencies = getDependencies;
exports.mockImpl = mockImpl;
const theme_check_common_1 = require("@shopify/theme-check-common");
const theme_check_node_1 = require("@shopify/theme-check-node");
const vitest_1 = require("vitest");
const vscode_uri_1 = require("vscode-uri");
const getWebComponentMap_1 = require("../getWebComponentMap");
const toSourceCode_1 = require("../toSourceCode");
const utils_1 = require("../utils");
function makeGetSourceCode(fs) {
    return (0, theme_check_common_1.memoize)(async function getSourceCode(uri) {
        const source = await fs.readFile(uri);
        return (0, toSourceCode_1.toSourceCode)(vscode_uri_1.URI.file(uri).toString(), source);
    }, utils_1.identity);
}
exports.fixturesRoot = theme_check_common_1.path.join(vscode_uri_1.URI.file(__dirname), ...'../../fixtures'.split('/'));
exports.skeleton = theme_check_common_1.path.join(exports.fixturesRoot, 'skeleton');
async function getDependencies(rootUri, fs = theme_check_node_1.NodeFileSystem) {
    const getSourceCode = makeGetSourceCode(fs);
    const deps = {
        fs,
        getSectionSchema: (0, theme_check_common_1.memoize)(async (name) => {
            const uri = theme_check_common_1.path.join(exports.skeleton, 'sections', `${name}.liquid`);
            const sourceCode = (await getSourceCode(uri));
            return (await (0, theme_check_common_1.toSchema)('theme', uri, sourceCode, async () => true));
        }, utils_1.identity),
        getBlockSchema: (0, theme_check_common_1.memoize)(async (name) => {
            const uri = theme_check_common_1.path.join(exports.skeleton, 'blocks', `${name}.liquid`);
            const sourceCode = (await getSourceCode(uri));
            return (await (0, theme_check_common_1.toSchema)('theme', uri, sourceCode, async () => true));
        }, utils_1.identity),
        getSourceCode,
        getWebComponentDefinitionReference: (customElementName) => webComponentDefs.get(customElementName),
    };
    const webComponentDefs = await (0, getWebComponentMap_1.getWebComponentMap)(rootUri, deps);
    return deps;
}
// This thing is way too hard to type.
function mockImpl(obj, method, callback) {
    const original = obj[method].bind(obj);
    return vitest_1.vi.spyOn(obj, method).mockImplementation(function () {
        return callback(original, ...arguments);
    });
}
//# sourceMappingURL=test-helpers.js.map