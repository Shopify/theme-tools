"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveToDiskFixApplicator = void 0;
exports.autofix = autofix;
const promises_1 = require("fs/promises");
const theme_check_common_1 = require("@shopify/theme-check-common");
const saveToDiskFixApplicator = async (sourceCode, fix) => {
    const updatedSource = (0, theme_check_common_1.applyFixToString)(sourceCode.source, fix);
    await (0, promises_1.writeFile)(theme_check_common_1.path.fsPath(sourceCode.uri), updatedSource, 'utf8');
};
exports.saveToDiskFixApplicator = saveToDiskFixApplicator;
/**
 * Apply and save to disk the safe fixes for a set of offenses on a theme.
 */
async function autofix(sourceCodes, offenses) {
    await (0, theme_check_common_1.autofix)(sourceCodes, offenses, exports.saveToDiskFixApplicator);
}
//# sourceMappingURL=autofix.js.map