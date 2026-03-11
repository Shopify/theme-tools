"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeGetMetafieldDefinitions = exports.FETCHED_METAFIELD_CATEGORIES = exports.makeGetDefaultSchemaTranslations = exports.makeGetDefaultTranslations = exports.makeGetDefaultSchemaLocale = exports.makeGetDefaultLocale = exports.makeGetDefaultSchemaLocaleFileUri = exports.makeGetDefaultLocaleFileUri = exports.makeFileSize = exports.makeFileExists = void 0;
exports.recursiveReadDirectory = recursiveReadDirectory;
exports.isDirectory = isDirectory;
const vscode_uri_1 = require("vscode-uri");
const AbstractFileSystem_1 = require("./AbstractFileSystem");
const json_1 = require("./json");
const path_1 = require("./path");
const types_1 = require("./types");
const utils_1 = require("./utils");
const makeFileExists = (fs) => async function fileExists(uri) {
    try {
        await fs.stat(uri);
        return true;
    }
    catch (e) {
        return false;
    }
};
exports.makeFileExists = makeFileExists;
const makeFileSize = (fs) => async function fileSize(uri) {
    try {
        const stats = await fs.stat(uri);
        return stats.size;
    }
    catch (error) {
        return 0;
    }
};
exports.makeFileSize = makeFileSize;
exports.makeGetDefaultLocaleFileUri = getDefaultLocaleFileUriFactoryFactory('default.json');
exports.makeGetDefaultSchemaLocaleFileUri = getDefaultLocaleFileUriFactoryFactory('.default.schema.json');
function getDefaultLocaleFileUriFactoryFactory(postfix = '.default.json') {
    return function getDefaultLocaleFileUriFactory(fs) {
        return (rootUri) => getDefaultLocaleFile(fs, rootUri, postfix);
    };
}
exports.makeGetDefaultLocale = getDefaultLocaleFactoryFactory('.default.json');
exports.makeGetDefaultSchemaLocale = getDefaultLocaleFactoryFactory('.default.schema.json');
function getDefaultLocaleFactoryFactory(postfix = '.default.json') {
    return function getDefaultLocaleFactory(fs, rootUri) {
        return cached(() => getDefaultLocale(fs, rootUri, postfix));
    };
}
exports.makeGetDefaultTranslations = getDefaultTranslationsFactoryFactory('.default.json');
exports.makeGetDefaultSchemaTranslations = getDefaultTranslationsFactoryFactory('.default.schema.json');
// prettier-ignore
function getDefaultTranslationsFactoryFactory(postfix = '.default.json') {
    return function getDefaultTranslationsFactory(fs, theme, rootUri) {
        return cached(() => getDefaultTranslations(fs, theme, rootUri, postfix));
    };
}
async function getDefaultLocaleFile(fs, rootUri, postfix = '.default.json') {
    var _a;
    const files = await fs.readDirectory((0, path_1.join)(rootUri, 'locales'));
    return (_a = files.find(([uri]) => uri.endsWith(postfix))) === null || _a === void 0 ? void 0 : _a[0];
}
async function getDefaultLocale(fs, rootUri, postfix) {
    try {
        const defaultLocaleFile = await getDefaultLocaleFile(fs, rootUri, postfix);
        if (!defaultLocaleFile)
            return 'en';
        const defaultLocaleFileName = vscode_uri_1.Utils.basename(vscode_uri_1.URI.parse(defaultLocaleFile));
        return defaultLocaleFileName.split('.')[0];
    }
    catch (error) {
        console.error(error);
        return 'en';
    }
}
async function getDefaultTranslations(fs, theme, rootUri, postfix) {
    try {
        const bufferTranslations = getDefaultTranslationsFromBuffer(theme, postfix);
        if (bufferTranslations)
            return bufferTranslations;
        const defaultLocaleFile = await getDefaultLocaleFile(fs, rootUri, postfix);
        if (!defaultLocaleFile)
            return {};
        const defaultTranslationsFile = await fs.readFile(defaultLocaleFile);
        return (0, json_1.parseJSON)(defaultTranslationsFile, {});
    }
    catch (error) {
        console.error(error);
        return {};
    }
}
/** It might be that you have an open buffer, we prefer translations from there if available */
function getDefaultTranslationsFromBuffer(theme, postfix) {
    const defaultTranslationsSourceCode = theme.find((sourceCode) => sourceCode.type === types_1.SourceCodeType.JSON &&
        sourceCode.uri.match(/locales/) &&
        sourceCode.uri.endsWith(postfix));
    if (!defaultTranslationsSourceCode)
        return undefined;
    const translations = (0, json_1.parseJSON)(defaultTranslationsSourceCode.source);
    if ((0, utils_1.isError)(translations))
        return undefined;
    return translations;
}
function cached(fn) {
    let cachedPromise;
    return async (...args) => {
        if (!cachedPromise)
            cachedPromise = fn(...args);
        return cachedPromise;
    };
}
async function recursiveReadDirectory(fs, uri, filter) {
    const allFiles = await fs.readDirectory(uri);
    const files = allFiles.filter((ft) => !isIgnored(ft) && (isDirectory(ft) || filter(ft)));
    const results = await Promise.all(files.map((ft) => {
        if (isDirectory(ft)) {
            return recursiveReadDirectory(fs, ft[0], filter);
        }
        else {
            return Promise.resolve([ft[0]]);
        }
    }));
    return results.flat();
}
function isDirectory([_, type]) {
    return type === AbstractFileSystem_1.FileType.Directory;
}
const ignoredFolders = ['.git', 'node_modules', 'dist', 'build', 'tmp', 'vendor'];
function isIgnored([uri, type]) {
    return type === AbstractFileSystem_1.FileType.Directory && ignoredFolders.some((folder) => uri.endsWith(folder));
}
exports.FETCHED_METAFIELD_CATEGORIES = [
    'article',
    'blog',
    'collection',
    'company',
    'company_location',
    'location',
    'market',
    'order',
    'page',
    'product',
    'variant',
    'shop',
];
const makeGetMetafieldDefinitions = (fs) => async function (rootUri) {
    const definitions = {
        article: [],
        blog: [],
        collection: [],
        company: [],
        company_location: [],
        location: [],
        market: [],
        order: [],
        page: [],
        product: [],
        variant: [],
        shop: [],
    };
    try {
        const content = await fs.readFile((0, path_1.join)(rootUri, '.shopify', 'metafields.json'));
        const json = (0, json_1.parseJSON)(content);
        if ((0, utils_1.isError)(json))
            return definitions;
        return exports.FETCHED_METAFIELD_CATEGORIES.reduce((definitions, group) => {
            try {
                definitions[group] = json[group].map((definition) => ({
                    key: definition.key,
                    name: definition.name,
                    namespace: definition.namespace,
                    description: definition.description,
                    type: {
                        category: definition.type.category,
                        name: definition.type.name,
                    },
                }));
            }
            catch (error) {
                // If there are errors in the file, we ignore it
            }
            return definitions;
        }, definitions);
    }
    catch (err) {
        return definitions;
    }
};
exports.makeGetMetafieldDefinitions = makeGetMetafieldDefinitions;
//# sourceMappingURL=context-utils.js.map