"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigDescription = loadConfigDescription;
const theme_check_common_1 = require("@shopify/theme-check-common");
const node_path_1 = __importDefault(require("node:path"));
const file_utils_1 = require("../file-utils");
const installation_location_1 = require("./installation-location");
const load_third_party_checks_1 = require("./load-third-party-checks");
const vscode_uri_1 = require("vscode-uri");
const flatten = (arrs) => arrs.flat();
/**
 * Creates the checks array, loads node modules checks and validates
 * settings against the respective check schemas.
 *
 * Effectively "loads" a ConfigDescription into a Config.
 */
async function loadConfigDescription(configDescription, root) {
    var _a;
    const nodeModuleRoot = await findNodeModuleRoot(root);
    const thirdPartyChecksPaths = await Promise.all([
        (0, load_third_party_checks_1.findThirdPartyChecks)((0, installation_location_1.thisNodeModuleRoot)()), // global checks
        (0, load_third_party_checks_1.findThirdPartyChecks)(nodeModuleRoot),
    ]).then(flatten);
    const thirdPartyChecks = (0, load_third_party_checks_1.loadThirdPartyChecks)([
        ...configDescription.require,
        ...thirdPartyChecksPaths,
    ]);
    const checks = theme_check_common_1.allChecks
        .concat(thirdPartyChecks)
        .filter(isEnabledBy(configDescription));
    const rootUri = vscode_uri_1.URI.file(root);
    return {
        settings: unaliasedSettings(configDescription.checkSettings, checks),
        context: (_a = configDescription.context) !== null && _a !== void 0 ? _a : 'theme',
        checks,
        ignore: configDescription.ignore,
        rootUri: resolveRoot(rootUri, configDescription.root),
    };
}
/**
 * @param root - absolute path of the config file
 * @param pathLike - resolved textual value of the `root` property from the config files
 * @returns {string} resolved URI of the root property
 */
function resolveRoot(root, pathLike) {
    if (pathLike === undefined) {
        return theme_check_common_1.path.normalize(root);
    }
    if (node_path_1.default.isAbsolute(pathLike)) {
        throw new Error('the "root" property can only be relative');
    }
    return theme_check_common_1.path.resolve(root, pathLike);
}
const isEnabledBy = (config) => (checkDefinition) => {
    var _a;
    const checkSettings = (_a = config.checkSettings[checkDefinition.meta.code]) !== null && _a !== void 0 ? _a : aliasedSettings(config, checkDefinition);
    if (!checkSettings)
        return false;
    return checkSettings.enabled;
};
function aliasedSettings(config, checkDefinition) {
    if (!checkDefinition.meta.aliases)
        return undefined;
    const usedAlias = checkDefinition.meta.aliases.find((alias) => config.checkSettings[alias]);
    if (!usedAlias)
        return undefined;
    return config.checkSettings[usedAlias];
}
function unaliasedSettings(settings, checks) {
    return Object.fromEntries(Object.entries(settings).map(([code, value]) => {
        return [unaliasedCode(code, checks), value];
    }));
}
function unaliasedCode(code, checks) {
    const check = checks.find((check) => { var _a; return check.meta.code === code || ((_a = check.meta.aliases) === null || _a === void 0 ? void 0 : _a.find((alias) => alias === code)); });
    return check === null || check === void 0 ? void 0 : check.meta.code;
}
async function isNodeModuleRoot(root) {
    // is absolute absolute root
    if (node_path_1.default.dirname(root) === root) {
        return true;
    }
    const [isNodeModuleRoot, isGitRoot] = await Promise.all([
        (0, file_utils_1.fileExists)(node_path_1.default.join(root, 'node_modules')),
        (0, file_utils_1.fileExists)(node_path_1.default.join(root, '.git')),
    ]);
    return isNodeModuleRoot || isGitRoot;
}
async function findNodeModuleRoot(root) {
    let curr = root;
    while (!(await isNodeModuleRoot(curr))) {
        curr = node_path_1.default.dirname(curr);
    }
    return curr;
}
//# sourceMappingURL=load-config-description.js.map