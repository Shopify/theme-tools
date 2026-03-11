"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = exports.NodeFileSystem = void 0;
exports.toSourceCode = toSourceCode;
exports.check = check;
exports.checkAndAutofix = checkAndAutofix;
exports.themeCheckRun = themeCheckRun;
exports.getThemeAndConfig = getThemeAndConfig;
exports.getTheme = getTheme;
exports.getThemeFilesPathPattern = getThemeFilesPathPattern;
const theme_check_common_1 = require("@shopify/theme-check-common");
const theme_check_docs_updater_1 = require("@shopify/theme-check-docs-updater");
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
const vscode_uri_1 = require("vscode-uri");
const glob = require("glob");
const autofix_1 = require("./autofix");
const config_1 = require("./config");
const NodeFileSystem_1 = require("./NodeFileSystem");
Object.defineProperty(exports, "NodeFileSystem", { enumerable: true, get: function () { return NodeFileSystem_1.NodeFileSystem; } });
const node_url_1 = require("node:url");
const asyncGlob = (0, node_util_1.promisify)(glob);
__exportStar(require("@shopify/theme-check-common"), exports);
__exportStar(require("./config/types"), exports);
const loadConfig = async (configPath, root) => {
    configPath !== null && configPath !== void 0 ? configPath : (configPath = await (0, config_1.findConfigPath)(root));
    return (0, config_1.loadConfig)(configPath, root);
};
exports.loadConfig = loadConfig;
async function toSourceCode(absolutePath) {
    try {
        const source = await promises_1.default.readFile(absolutePath, 'utf8');
        return (0, theme_check_common_1.toSourceCode)(theme_check_common_1.path.normalize(vscode_uri_1.URI.file(absolutePath)), source);
    }
    catch (e) {
        return undefined;
    }
}
async function check(root, configPath) {
    const run = await themeCheckRun(root, configPath);
    return run.offenses;
}
async function checkAndAutofix(root, configPath) {
    const { theme, offenses } = await themeCheckRun(root, configPath);
    await (0, autofix_1.autofix)(theme, offenses);
}
async function themeCheckRun(root, configPath, log = () => { }) {
    const { theme, config } = await getThemeAndConfig(root, configPath);
    const themeLiquidDocsManager = new theme_check_docs_updater_1.ThemeLiquidDocsManager(log);
    // This does feel a bit heavy handed, but I'm in a rush.
    //
    // Ultimately, I want to be able to have type safety on the parsed content
    // of the {% schema %} tags if the schema is known to be valid. This should make
    // {% schema %} related theme checks much easier to write than having to write visitor
    // code and doing null checks all over the place. `ThemeBlock.Schema` is much more specific
    // than `any` ever could be.
    //
    // I also want to have the option of passing down the getSectionSchema &
    // getBlockSchema functions as dependencies. This will enable me to cache the
    // results in the language server and avoid redoing validation between runs if
    // we know the schema of a file that didn't change is valid.
    //
    // The crux of my problem is that I want to be passing down the json validation set
    // as dependencies and not a full blown language service. But the easiest way
    // is to have a `isValidSchema` is to have the language service do the
    // validation of the JSON schema... We're technically going to have two
    // JSONValidator running in theme check (node). We already have two in the
    // language server.
    const validator = await theme_check_common_1.JSONValidator.create(themeLiquidDocsManager, config);
    const isValidSchema = validator === null || validator === void 0 ? void 0 : validator.isValid;
    // We can assume that all files are loaded when running themeCheckRun
    const schemas = theme.map((source) => (0, theme_check_common_1.toSchema)(config.context, source.uri, source, isValidSchema));
    // prettier-ignore
    const blockSchemas = new Map(theme.filter(source => (0, theme_check_common_1.isBlock)(source.uri)).map((source) => [
        node_path_1.default.basename(source.uri, '.liquid'),
        (0, theme_check_common_1.memo)(async () => (0, theme_check_common_1.toSchema)(config.context, source.uri, source, isValidSchema))
    ]));
    // prettier-ignore
    const sectionSchemas = new Map(theme.filter(source => (0, theme_check_common_1.isSection)(source.uri)).map((source) => [
        node_path_1.default.basename(source.uri, '.liquid'),
        (0, theme_check_common_1.memo)(async () => (0, theme_check_common_1.toSchema)(config.context, source.uri, source, isValidSchema))
    ]));
    const docDefinitions = new Map(theme.map((file) => [
        node_path_1.default.relative(vscode_uri_1.URI.file(root).toString(), file.uri),
        (0, theme_check_common_1.memo)(async () => {
            const ast = file.ast;
            if (!(0, liquid_html_parser_1.isLiquidHtmlNode)(ast)) {
                return undefined;
            }
            if (!(0, theme_check_common_1.filePathSupportsLiquidDoc)(file.uri)) {
                return undefined;
            }
            return (0, theme_check_common_1.extractDocDefinition)(file.uri, ast);
        }),
    ]));
    const offenses = await (0, theme_check_common_1.check)(theme, config, {
        fs: NodeFileSystem_1.NodeFileSystem,
        themeDocset: themeLiquidDocsManager,
        jsonValidationSet: themeLiquidDocsManager,
        // This is kind of gross, but we want those things to be lazy and called by name so...
        // In the language server, this is memo'ed in DocumentManager, but we don't have that kind
        // of luxury in CLI-mode.
        getSectionSchema: async (name) => { var _a; return (_a = sectionSchemas.get(name)) === null || _a === void 0 ? void 0 : _a(); },
        getBlockSchema: async (name) => { var _a; return (_a = blockSchemas.get(name)) === null || _a === void 0 ? void 0 : _a(); },
        getAppBlockSchema: async (name) => { var _a; return (_a = blockSchemas.get(name)) === null || _a === void 0 ? void 0 : _a(); }, // cheating... but TODO
        getDocDefinition: async (relativePath) => { var _a; return (_a = docDefinitions.get(relativePath)) === null || _a === void 0 ? void 0 : _a(); },
    });
    return {
        theme,
        config,
        offenses,
    };
}
async function getThemeAndConfig(root, configPath) {
    const config = await (0, exports.loadConfig)(configPath, root);
    const theme = await getTheme(config);
    return {
        theme,
        config,
    };
}
async function getTheme(config) {
    // On windows machines - the separator provided by path.join is '\'
    // however the glob function fails silently since '\' is used to escape glob charater
    // as mentioned in the documentation of node-glob
    // the path is normalised and '\' are replaced with '/' and then passed to the glob function
    let normalizedGlob = getThemeFilesPathPattern(config.rootUri);
    const paths = await asyncGlob(normalizedGlob, { absolute: true }).then((result) => 
    // Global ignored paths should not be part of the theme
    result.filter((filePath) => !(0, theme_check_common_1.isIgnored)(filePath, config)));
    const sourceCodes = await Promise.all(paths.map(toSourceCode));
    return sourceCodes.filter((x) => x !== undefined);
}
function getThemeFilesPathPattern(rootUri) {
    return node_path_1.default
        .normalize(node_path_1.default.join((0, node_url_1.fileURLToPath)(rootUri), '**/*.{liquid,json}'))
        .replace(/\\/g, '/');
}
//# sourceMappingURL=index.js.map