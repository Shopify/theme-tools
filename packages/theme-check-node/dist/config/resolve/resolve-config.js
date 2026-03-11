"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConfig = resolveConfig;
const node_path_1 = __importDefault(require("node:path"));
const read_yaml_1 = require("./read-yaml");
const merge_fragments_1 = require("./merge-fragments");
const types_1 = require("../types");
const modernConfigsPath = () => {
    if (process.env.WEBPACK_MODE) {
        return node_path_1.default.resolve(__dirname, './configs');
    }
    else {
        return node_path_1.default.resolve(__dirname, '../../../configs');
    }
};
/**
 * Given a modern identifier or absolute path, fully resolves and flattens
 * a config description. In other words, extends are all loaded and merged with
 * the config at the configPath.
 */
async function resolveConfig(configPath, isRootConfig = false) {
    if (isModernIdentifier(configPath)) {
        const modernConfigPath = node_path_1.default.join(modernConfigsPath(), configPath.replace(/^theme-check:/, '') + '.yml');
        return resolveConfig(modernConfigPath);
    }
    // TODO: Add support for more file formats.
    const current = await (0, read_yaml_1.readYamlConfigDescription)(configPath, isRootConfig);
    const baseConfigs = await Promise.all(current.extends.map((extend) => resolveConfig(extend)));
    return (0, merge_fragments_1.mergeFragments)(baseConfigs, current);
}
function isModernIdentifier(thing) {
    return types_1.ModernIdentifiers.includes(thing);
}
//# sourceMappingURL=resolve-config.js.map