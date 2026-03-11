"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readYamlConfigDescription = readYamlConfigDescription;
const theme_check_common_1 = require("@shopify/theme-check-common");
const node_fs_1 = require("node:fs");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const yaml_1 = require("yaml");
const types_1 = require("../types");
class UnresolvedAliasError extends Error {
    constructor(message, alias) {
        super(message);
        this.name = 'UnresolvedAliasError';
        this.message = `YAML parsing error: Unresolved alias *${alias}.
Did you forget to wrap your ignore statement in quotes? '*${alias}'
${message}`;
    }
}
function parseYamlFile(absolutePath, contents) {
    try {
        const result = contents.trim() === '' ? {} : (0, yaml_1.parse)(contents);
        if (!isPlainObject(result)) {
            throw new Error(`Expecting parsed contents of config file at path '${absolutePath}' to be a plain object`);
        }
        return result;
    }
    catch (error) {
        if (error instanceof Error &&
            error.name === 'ReferenceError' &&
            error.message.includes('Unresolved alias') &&
            /: .*$/m.test(error.message)) {
            const alias = /: .*$/m.exec(error.message)[0].slice(2);
            throw new UnresolvedAliasError(error.message, alias);
        }
        else {
            throw error;
        }
    }
}
/**
 * Takes an absolute path, parses the yaml at that path and turns it into a
 * ConfigFragment object.
 */
async function readYamlConfigDescription(
/** the absolute path to a theme-check.yml file */
absolutePath, 
/** only the root config has `extends: theme-check:recommended` by default, it's nothing everywhere else */
isRootConfig = false) {
    const root = node_path_1.default.dirname(absolutePath);
    const contents = await promises_1.default.readFile(absolutePath, 'utf8');
    const yamlFile = parseYamlFile(absolutePath, contents);
    const config = {
        checkSettings: {},
        ignore: [],
        extends: [],
        require: [],
    };
    if (yamlFile.root) {
        config.root = yamlFile.root;
        delete yamlFile.root;
    }
    if (yamlFile.ignore) {
        config.ignore = asArray(yamlFile.ignore);
        delete yamlFile.ignore;
    }
    if (yamlFile.require) {
        config.require = asArray(yamlFile.require)
            .map((pathLike) => resolvePath(root, pathLike))
            .filter(isString);
        delete yamlFile.require;
    }
    if (yamlFile.extends) {
        config.extends = asArray(yamlFile.extends)
            .map((pathLike) => resolveExtends(root, pathLike))
            .filter(isString);
        delete yamlFile.extends;
    }
    else if (isRootConfig) {
        config.extends = [resolveExtends(root, 'theme-check:recommended')];
    }
    if (yamlFile.context) {
        if (theme_check_common_1.Modes.includes(yamlFile.context)) {
            config.context = yamlFile.context;
        }
        delete yamlFile.context;
    }
    // legacy settings that screw up assumptions
    if (yamlFile.include_categories)
        delete yamlFile.include_categories;
    if (yamlFile.exclude_categories)
        delete yamlFile.exclude_categories;
    for (const [checkName, settings] of Object.entries(yamlFile)) {
        if (!isPlainObject(settings)) {
            throw new Error(`Expected a plain object value for ${checkName} but got ${typeof settings}`);
        }
        config.checkSettings[checkName] = resolveSettings(settings);
    }
    return config;
}
/**
 * resolves the `extends:` property of configuration files.
 *
 * pathLike can be any of the following:
 * - legacy identifiers:
 *   - a symbol (e.g. :default, :nothing, :theme_app_extension)
 *   - the special string version of the symbols (e.g. default, nothing)
 * - modern identifiers:
 *   - theme-check:all
 *   - theme-check:recommended
 *   - theme-check:theme-app-extension
 *   - a node_module (e.g. '@acme/theme-check-recommended')
 *   - a relative path (e.g. '../configurations/theme-check.yml')
 *
 * @returns {string} resolved absolute path of the extended config
 */
function resolveExtends(
/** absolute path of the config file */
root, 
/** pathLike textual value of the `extends` property in the config file */
pathLike) {
    if (pathLike.startsWith(':') || types_1.LegacyIdentifiers.has(pathLike)) {
        return types_1.LegacyIdentifiers.get(pathLike.replace(/^:/, ''));
    }
    if (pathLike.startsWith('theme-check:')) {
        return pathLike;
    }
    return resolvePath(root, pathLike);
}
/**
 * resolves a pathLike property from the configuration file.
 *
 * pathLike can be any of the following:
 *   - a node_module (e.g. '@acme/theme-check-extension')
 *   - a relative path (e.g. './lib/main.js')
 *
 * @returns {string} resolved absolute path of the extended config
 */
function resolvePath(
/** absolute path of the config file */
root, 
/** pathLike textual value of the `extends` property in the config file */
pathLike) {
    if (node_path_1.default.isAbsolute(pathLike)) {
        return pathLike;
    }
    if (pathLike.startsWith('.')) {
        return node_path_1.default.resolve(root, pathLike);
    }
    return (0, node_fs_1.realpathSync)(require.resolve(pathLike, { paths: getAncestorNodeModules(root) }));
}
/**
 * Resolves the check settings. Will also camelCase the snake_case settings
 * for backwards compatibility.
 */
function resolveSettings(
/** key value pair of settings for a check */
settings) {
    const resolvedSettings = {
        enabled: settings.enabled || true,
    };
    for (const [key, value] of Object.entries(settings)) {
        resolvedSettings[toCamelCase(key)] = value;
    }
    if (settings.ignore !== undefined &&
        Array.isArray(settings.ignore) &&
        settings.ignore.every(isString)) {
        resolvedSettings.ignore = settings.ignore;
    }
    if (settings.severity !== undefined) {
        resolvedSettings.severity = resolveSeverity(settings.severity);
    }
    return resolvedSettings;
}
function resolveSeverity(severity) {
    if (isConvenienceSeverity(severity))
        return types_1.ConvenienceSeverities[severity];
    if (isSeverity(severity))
        return severity;
    throw new Error(`Unsupported severity: ${severity}. Try one of ${Object.keys(types_1.ConvenienceSeverities)}`);
}
function isConvenienceSeverity(severity) {
    return typeof severity === 'string' && severity in types_1.ConvenienceSeverities;
}
function isSeverity(severity) {
    return typeof severity === 'number' && severity in theme_check_common_1.Severity;
}
function toCamelCase(maybeSnakeCaseStr) {
    return maybeSnakeCaseStr.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
function isPlainObject(thing) {
    return Object.prototype.toString.call(thing) === '[object Object]';
}
function isString(thing) {
    return typeof thing === 'string';
}
function asArray(thing) {
    return Array.isArray(thing) ? thing : [thing];
}
function getAncestorNodeModules(dir) {
    const root = node_path_1.default.parse(dir).root;
    const nodeModulesPaths = [];
    while (dir !== root) {
        nodeModulesPaths.push(node_path_1.default.join(dir, 'node_modules'));
        dir = node_path_1.default.dirname(dir);
    }
    return nodeModulesPaths;
}
//# sourceMappingURL=read-yaml.js.map