"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = void 0;
const theme_check_node_1 = require("@shopify/theme-check-node");
const theme_language_server_common_1 = require("@shopify/theme-language-server-common");
const vscode_uri_1 = require("vscode-uri");
// Calls to `fs` should be done with this
function asFsPath(uriOrPath) {
    if (vscode_uri_1.URI.isUri(uriOrPath)) {
        return uriOrPath.fsPath;
    }
    else if (/^file:/i.test(uriOrPath)) {
        return vscode_uri_1.URI.parse(uriOrPath).fsPath;
    }
    else {
        return vscode_uri_1.URI.file(uriOrPath).fsPath;
    }
}
const hasThemeAppExtensionConfig = async (rootUri, fs) => {
    const files = await (0, theme_check_node_1.recursiveReadDirectory)(fs, rootUri, ([uri]) => uri.endsWith('.extension.toml'));
    return files.length > 0;
};
const loadConfig = async function loadConfig(uriString, fs) {
    const fileUri = theme_check_node_1.path.normalize(uriString);
    const fileExists = (0, theme_check_node_1.makeFileExists)(fs);
    const rootUriString = await (0, theme_check_node_1.findRoot)(fileUri, fileExists);
    if (!rootUriString) {
        throw new Error(`Could not find theme root for ${fileUri}`);
    }
    const rootUri = vscode_uri_1.URI.parse(rootUriString);
    const scheme = rootUri.scheme;
    const configUri = vscode_uri_1.Utils.joinPath(rootUri, '.theme-check.yml');
    const [configExists, isDefinitelyThemeAppExtension] = await Promise.all([
        fileExists(theme_check_node_1.path.normalize(configUri)),
        hasThemeAppExtensionConfig(theme_check_node_1.path.normalize(rootUri), fs),
    ]);
    if (scheme === 'file') {
        const configPath = asFsPath(configUri);
        const rootPath = asFsPath(rootUri);
        if (configExists) {
            return (0, theme_check_node_1.loadConfig)(configPath, rootPath).then(normalizeRoot);
        }
        else if (isDefinitelyThemeAppExtension) {
            return (0, theme_check_node_1.loadConfig)('theme-check:theme-app-extension', rootPath).then(normalizeRoot);
        }
        else {
            return (0, theme_check_node_1.loadConfig)(undefined, rootPath).then(normalizeRoot);
        }
    }
    else {
        // We can't load configs properly in remote environments.
        // Reading and parsing YAML files is possible, but resolving `extends` and `require` fields isn't.
        // We'll do the same thing prettier does, we just won't load configs.
        return {
            checks: theme_language_server_common_1.recommendedChecks,
            settings: {},
            context: isDefinitelyThemeAppExtension ? 'app' : 'theme',
            rootUri: theme_check_node_1.path.normalize(rootUri),
        };
    }
};
exports.loadConfig = loadConfig;
function normalizeRoot(config) {
    config.rootUri = theme_check_node_1.path.normalize(config.rootUri);
    return config;
}
//# sourceMappingURL=dependencies.js.map