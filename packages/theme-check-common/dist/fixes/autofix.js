"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autofix = autofix;
const correctors_1 = require("./correctors");
const utils_1 = require("./utils");
/**
 * Takes a theme, list of offenses and a fixApplicator and runs all the
 * safe ones on the theme.
 *
 * Note that offense.fix is assumed to be safe, unlike offense.suggest
 * options.
 */
async function autofix(sourceCodes, offenses, applyFixes) {
    const fixableOffenses = offenses.filter((offense) => 'fix' in offense && !!offense.fix);
    const promises = [];
    for (const sourceCode of sourceCodes) {
        const sourceCodeOffenses = fixableOffenses.filter((offense) => offense.uri === sourceCode.uri);
        if (sourceCodeOffenses.length === 0) {
            continue;
        }
        const corrector = (0, correctors_1.createCorrector)(sourceCode.type, sourceCode.source);
        for (const offense of sourceCodeOffenses) {
            // I'm being slightly too clever for TypeScript here...
            offense.fix(corrector);
        }
        promises.push(applyFixes(sourceCode, (0, utils_1.flattenFixes)(corrector.fix)));
    }
    await Promise.all(promises);
}
//# sourceMappingURL=autofix.js.map