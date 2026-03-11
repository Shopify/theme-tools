"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreCheck = exports.FileType = exports.recommended = exports.allChecks = exports.toSourceCode = void 0;
exports.getTheme = getTheme;
exports.simpleCheck = simpleCheck;
const theme_check_common_1 = require("@shopify/theme-check-common");
Object.defineProperty(exports, "allChecks", { enumerable: true, get: function () { return theme_check_common_1.allChecks; } });
Object.defineProperty(exports, "coreCheck", { enumerable: true, get: function () { return theme_check_common_1.check; } });
Object.defineProperty(exports, "toSourceCode", { enumerable: true, get: function () { return theme_check_common_1.toSourceCode; } });
Object.defineProperty(exports, "recommended", { enumerable: true, get: function () { return theme_check_common_1.recommended; } });
Object.defineProperty(exports, "FileType", { enumerable: true, get: function () { return theme_check_common_1.FileType; } });
function getTheme(themeDesc) {
    return Object.entries(themeDesc)
        .map(([relativePath, source]) => (0, theme_check_common_1.toSourceCode)(toUri(relativePath), source))
        .filter((x) => x !== undefined);
}
/**
 * In the event where you don't care about reusing your SourceCode objects, simpleCheck works alright.
 *
 * But if you want to manage your memory (e.g. don't reparse ASTs for files that were not modified),
 * it might be preferable to call coreCheck directly.
 */
async function simpleCheck(themeDesc, config, dependencies) {
    const theme = getTheme(themeDesc);
    return (0, theme_check_common_1.check)(theme, config, dependencies);
}
function toUri(relativePath) {
    return 'browser:/' + relativePath;
}
//# sourceMappingURL=index.js.map