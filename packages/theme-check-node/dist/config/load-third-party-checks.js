"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadThirdPartyChecks = loadThirdPartyChecks;
exports.findThirdPartyChecks = findThirdPartyChecks;
const glob_1 = __importDefault(require("glob"));
const node_util_1 = require("node:util");
const asyncGlob = (0, node_util_1.promisify)(glob_1.default);
function loadThirdPartyChecks(
/**
 * An array of require()-able paths.
 * @example
 * [
 *   '@acme/theme-check-extension',
 *   '/absolute/path/to/checks.js',
 *   './lib/checks.js',
 * ]
 * */
modulePaths = []) {
    const checks = new Set();
    for (const modulePath of modulePaths) {
        try {
            const moduleValue = require(/* webpackIgnore: true */ modulePath);
            const moduleChecks = moduleValue.checks;
            if (!Array.isArray(moduleChecks)) {
                throw new Error(`Expected the 'checks' export to be an array and got ${typeof moduleChecks}`);
            }
            for (const check of moduleChecks) {
                if (isCheckDefinition(check)) {
                    checks.add(check);
                }
                else {
                    console.error(`Expected ${check} to be a CheckDefinition, but it looks like it isn't`);
                }
            }
        }
        catch (e) {
            console.error(`Error loading ${modulePath}, ignoring it.\n${e}`);
        }
    }
    return [...checks];
}
async function findThirdPartyChecks(nodeModuleRoot) {
    const paths = [
        globJoin(nodeModuleRoot.replace(/\\/g, '/'), '/node_modules/theme-check-*/'),
        globJoin(nodeModuleRoot.replace(/\\/g, '/'), '/node_modules/@*/theme-check-*/'),
    ];
    const results = await Promise.all(paths.map((path) => asyncGlob(path)));
    return results
        .flat()
        .filter((x) => !/\@shopify\/theme-check-(node|common|browser|docs-updater)/.test(x) &&
        !/theme-check-vscode/.test(x));
}
function globJoin(...parts) {
    return parts.flatMap((x) => x.replace(/\\/g, '/').replace(/\/+$/, '')).join('/');
}
function isObjLiteral(thing) {
    return thing !== null && typeof thing === 'object';
}
function isCheckDefinition(thing) {
    return (isObjLiteral(thing) &&
        'meta' in thing &&
        'create' in thing &&
        isObjLiteral(thing.meta) &&
        'code' in thing.meta);
}
//# sourceMappingURL=load-third-party-checks.js.map