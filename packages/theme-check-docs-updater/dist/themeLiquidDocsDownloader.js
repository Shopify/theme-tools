"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Manifests = exports.Resources = exports.ThemeLiquidDocsSchemaRoot = exports.ThemeLiquidDocsRoot = exports.root = void 0;
exports.downloadSchema = downloadSchema;
exports.downloadResource = downloadResource;
exports.download = download;
exports.resourcePath = resourcePath;
exports.resourceUrl = resourceUrl;
exports.schemaPath = schemaPath;
exports.schemaUrl = schemaUrl;
exports.exists = exists;
exports.downloadThemeLiquidDocs = downloadThemeLiquidDocs;
const env_paths_1 = __importDefault(require("env-paths"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const utils_1 = require("./utils");
const paths = (0, env_paths_1.default)('theme-liquid-docs');
exports.root = paths.cache;
exports.ThemeLiquidDocsRoot = 'https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main';
exports.ThemeLiquidDocsSchemaRoot = `${exports.ThemeLiquidDocsRoot}/schemas`;
exports.Resources = [
    'filters',
    'objects',
    'tags',
    'shopify_system_translations',
    'manifest_theme',
    'manifest_theme_app_extension',
];
exports.Manifests = {
    app: 'manifest_theme_app_extension',
    theme: 'manifest_theme',
};
const THEME_LIQUID_DOCS = {
    filters: 'data/filters.json',
    objects: 'data/objects.json',
    tags: 'data/tags.json',
    latest: 'data/latest.json',
    shopify_system_translations: 'data/shopify_system_translations.json',
    manifest_theme: 'schemas/manifest_theme.json',
    manifest_theme_app_extension: 'schemas/manifest_theme_app_extension.json',
};
async function downloadSchema(relativeUri, destination = exports.root, log = utils_1.noop) {
    const remotePath = schemaUrl(relativeUri);
    const localPath = schemaPath(relativeUri, destination);
    const text = await download(remotePath, log);
    await promises_1.default.writeFile(localPath, text, 'utf8');
    return text;
}
async function downloadResource(resource, destination = exports.root, log = utils_1.noop) {
    const remotePath = resourceUrl(resource);
    const localPath = resourcePath(resource, destination);
    const text = await download(remotePath, log);
    await promises_1.default.writeFile(localPath, text, 'utf8');
    return text;
}
async function download(path, log) {
    if (path.startsWith('file:')) {
        return await promises_1.default
            .readFile(path.replace(/^file:/, ''), 'utf8')
            .then((0, utils_1.tap)(() => log(`Using local file: ${path}`)))
            .catch((error) => {
            log(`Failed to read local file: ${path}`);
            throw error;
        });
    }
    else {
        const res = await (0, node_fetch_1.default)(path);
        return res.text();
    }
}
function resourcePath(resource, destination = exports.root) {
    return node_path_1.default.join(destination, `${resource}.json`);
}
function resourceUrl(resource) {
    const relativePath = THEME_LIQUID_DOCS[resource];
    const resourceRoot = process.env.SHOPIFY_TLD_ROOT
        ? `file:${process.env.SHOPIFY_TLD_ROOT}`
        : exports.ThemeLiquidDocsRoot;
    return `${resourceRoot}/${relativePath}`;
}
function schemaPath(relativeUri, destination = exports.root) {
    return node_path_1.default.resolve(destination, node_path_1.default.basename(relativeUri));
}
function schemaUrl(relativeUri) {
    const schemaRoot = process.env.SHOPIFY_TLD_ROOT
        ? `file:${process.env.SHOPIFY_TLD_ROOT}`
        : exports.ThemeLiquidDocsRoot;
    return `${schemaRoot}/schemas/${relativeUri}`;
}
async function exists(path) {
    try {
        await promises_1.default.stat(path);
        return true;
    }
    catch (e) {
        return false;
    }
}
async function downloadThemeLiquidDocs(destination, log) {
    if (!(await exists(destination))) {
        await promises_1.default.mkdir(destination);
    }
    const resources = ['latest'].concat(exports.Resources);
    const resourceContents = await Promise.all(resources.map((file) => {
        return downloadResource(file, destination, log)
            .then((0, utils_1.tap)(() => log(`Successfully downloaded latest resource:\n\t${resourceUrl(file)}\n\t> ${resourcePath(file, destination)}`)))
            .catch((error) => {
            log(`Failed to download latest resource:\n\t${resourceUrl(file)} to\n\t${resourcePath(file, destination)}\n${error}`);
            throw error;
        });
    }));
    const manifests = Object.values(exports.Manifests)
        .map((resource) => resources.indexOf(resource))
        .map((index) => resourceContents[index])
        .map((manifest) => JSON.parse(manifest));
    const relativeUris = manifests.flatMap((manifest) => manifest.schemas.map((schema) => schema.uri));
    await Promise.all(unique(relativeUris).map((uri) => downloadSchema(uri, destination, log)
        .then((0, utils_1.tap)(() => log(`Successfully downloaded schema:\n\t${schemaUrl(uri)}\n\t> ${schemaPath(uri, destination)}`)))
        .catch((error) => {
        log(`Failed to download schema: ${uri}, ${error}`);
        throw error;
    })));
}
function unique(array) {
    return [...new Set(array).values()];
}
//# sourceMappingURL=themeLiquidDocsDownloader.js.map