"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentDependencies = augmentDependencies;
const theme_check_common_1 = require("@shopify/theme-check-common");
const toSourceCode_1 = require("../toSourceCode");
const utils_1 = require("../utils");
function augmentDependencies(rootUri, ideps) {
    var _a;
    return {
        fs: ideps.fs,
        getBlockSchema: (0, theme_check_common_1.memoize)(ideps.getBlockSchema, utils_1.identity),
        getSectionSchema: (0, theme_check_common_1.memoize)(ideps.getSectionSchema, utils_1.identity),
        // parse at most once
        getSourceCode: (0, theme_check_common_1.memoize)((_a = ideps.getSourceCode) !== null && _a !== void 0 ? _a : async function defaultGetSourceCode(uri) {
            const contents = await ideps.fs.readFile(uri);
            return (0, toSourceCode_1.toSourceCode)(uri, contents);
        }, utils_1.identity),
        getWebComponentDefinitionReference: ideps.getWebComponentDefinitionReference,
        getThemeBlockNames: (0, theme_check_common_1.memo)(() => (0, theme_check_common_1.recursiveReadDirectory)(ideps.fs, theme_check_common_1.path.join(rootUri, 'blocks'), ([uri]) => uri.endsWith('.liquid')).then((uris) => uris.map((uri) => theme_check_common_1.path.basename(uri, '.liquid')))),
    };
}
//# sourceMappingURL=augment.js.map