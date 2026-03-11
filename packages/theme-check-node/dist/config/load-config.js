"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const load_config_description_1 = require("./load-config-description");
const resolve_1 = require("./resolve");
const validation_1 = require("./validation");
const promises_1 = __importDefault(require("fs/promises"));
/**
 * Given an absolute path to a config file, this function returns
 * the validated Config object that it represents.
 *
 * In detail, it does the following:
 *  - resolves and merges extended config,
 *  - resolves the absolute path of the root,
 *  - loads community-provided checks,
 *  - validates check settings.
 */
async function loadConfig(
/** The absolute path of config file */
configPath, 
/** The root of the theme */
root) {
    if (!root)
        throw new Error('loadConfig cannot be called without a root argument');
    let defaultChecks = 'theme-check:recommended';
    if (!configPath) {
        const files = await promises_1.default.readdir(root);
        // *.extension.toml implies that we're already in the appropriate extensions
        // directory. *.app.toml implies that we're inside the root of an app.
        if (files.some((file) => file.endsWith('.extension.toml') || file.endsWith('.app.toml'))) {
            defaultChecks = 'theme-check:theme-app-extension';
        }
    }
    const configDescription = await (0, resolve_1.resolveConfig)(configPath !== null && configPath !== void 0 ? configPath : defaultChecks, true);
    const config = await (0, load_config_description_1.loadConfigDescription)(configDescription, root);
    (0, validation_1.validateConfig)(config);
    return config;
}
//# sourceMappingURL=load-config.js.map