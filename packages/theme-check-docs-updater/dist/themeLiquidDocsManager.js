"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeLiquidDocsManager = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const themeLiquidDocsDownloader_1 = require("./themeLiquidDocsDownloader");
const utils_1 = require("./utils");
class ThemeLiquidDocsManager {
    constructor(log = utils_1.noop) {
        this.log = log;
        this.filters = (0, utils_1.memo)(async () => {
            return findSuitableResource(this.loaders('filters'), JSON.parse, [], this.log);
        });
        this.objects = (0, utils_1.memo)(async () => {
            return findSuitableResource(this.loaders('objects'), JSON.parse, [], this.log);
        });
        this.liquidDrops = (0, utils_1.memo)(async () => {
            return findSuitableResource(this.loaders('objects'), JSON.parse, [], this.log);
        });
        this.tags = (0, utils_1.memo)(async () => {
            return findSuitableResource(this.loaders('tags'), JSON.parse, [], this.log);
        });
        this.systemTranslations = (0, utils_1.memo)(async () => {
            return findSuitableResource(this.loaders('shopify_system_translations'), JSON.parse, {}, this.log);
        });
        this.schemas = (0, utils_1.memoize)((mode) => findSuitableResource(this.loaders(themeLiquidDocsDownloader_1.Manifests[mode]), JSON.parse, {
            schemas: [],
        }, this.log).then((manifest) => {
            return Promise.all(manifest.schemas.map(async (schemaDefinition) => ({
                uri: `${themeLiquidDocsDownloader_1.ThemeLiquidDocsSchemaRoot}/${schemaDefinition.uri}`,
                fileMatch: schemaDefinition.fileMatch,
                schema: await findSuitableResource(this.schemaLoaders(schemaDefinition.uri), utils_1.identity, '', this.log),
            })));
        }), (utils_1.identity));
        /**
         * The setup method checks that the latest revision matches the one from
         * Shopify/theme-liquid-docs. If there's a diff in revision, it means
         * that the documentations that you have locally are out of date.
         *
         * The setup method then downloads the other files.
         */
        this.setup = (0, utils_1.memo)(async () => {
            try {
                if (!(await (0, themeLiquidDocsDownloader_1.exists)(themeLiquidDocsDownloader_1.root))) {
                    await promises_1.default.mkdir(themeLiquidDocsDownloader_1.root, { recursive: true });
                }
                const local = await this.latestRevision();
                await (0, themeLiquidDocsDownloader_1.downloadResource)('latest', themeLiquidDocsDownloader_1.root, this.log);
                const remote = await this.latestRevision();
                if (local !== remote) {
                    await (0, themeLiquidDocsDownloader_1.downloadThemeLiquidDocs)(themeLiquidDocsDownloader_1.root, this.log);
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    this.log(`Failed to setup with the following error: ${error.message}`);
                }
                return;
            }
        });
    }
    async latestRevision() {
        var _a;
        const latest = await findSuitableResource([loader(() => this.load('latest'), 'loadLatestRevision')], JSON.parse, {}, this.log);
        return (_a = latest['revision']) !== null && _a !== void 0 ? _a : '';
    }
    async loadResource(name) {
        // Always wait for setup first. Since it's memoized, this will always
        // be the same promise.
        await this.setup();
        return this.load(name).then((0, utils_1.tap)(() => this.log(`Loaded resource from ${(0, themeLiquidDocsDownloader_1.resourcePath)(name)}`)));
    }
    async load(name) {
        return promises_1.default.readFile((0, themeLiquidDocsDownloader_1.resourcePath)(name), 'utf8');
    }
    async loadSchema(relativeUri) {
        return promises_1.default
            .readFile((0, themeLiquidDocsDownloader_1.schemaPath)(relativeUri), 'utf8')
            .then((0, utils_1.tap)(() => this.log(`Loaded schema from ${(0, themeLiquidDocsDownloader_1.schemaPath)(relativeUri)}`)));
    }
    loaders(name) {
        return [
            loader(() => this.loadResource(name), `loadResource(${name})`),
            loader(() => fallbackResource(name, this.log), `fallbackResource(${name})`),
        ];
    }
    schemaLoaders(relativeUri) {
        return [
            loader(() => this.loadSchema(relativeUri), `loadSchema(${relativeUri})`),
            loader(() => fallbackSchema(relativeUri, this.log), `fallbackSchema(${relativeUri})`),
        ];
    }
}
exports.ThemeLiquidDocsManager = ThemeLiquidDocsManager;
function loader(fn, loaderName) {
    return Object.assign(fn, { loaderName });
}
/**
 * Find the first resource that can be loaded and transformed.
 *
 * Will try to load the resource from the loaders in order. If the loader
 * throws an error, it will try the next loader. If all loaders throw an
 * error, it will return the default value.
 *
 * This should allow us to load the latest version of the resource if it's
 * available, and fall back to the local version if it's not. If neither
 * work, we'll just return the default value.
 */
async function findSuitableResource(dataLoaders, transform, defaultValue, log) {
    for (const loader of dataLoaders) {
        try {
            return transform(await loader());
        }
        catch (e) {
            log(`Failed to load or transform ${loader.loaderName} with the following error:\n${e instanceof Error ? e.message : e}`);
            continue;
        }
    }
    return defaultValue;
}
/**
 * The root directory for the data files. This is different in the VS Code build
 * (since those files are copied to the dist folder at a different relative path)
 */
function dataRoot() {
    if (process.env.WEBPACK_MODE) {
        return node_path_1.default.resolve(__dirname, './data');
    }
    else {
        return node_path_1.default.resolve(__dirname, '../data');
    }
}
/** Returns the at-build-time path to the fallback data file. */
async function fallbackResource(name, log) {
    const sourcePath = node_path_1.default.resolve(dataRoot(), `${name}.json`);
    return promises_1.default
        .readFile(sourcePath, 'utf8')
        .then((0, utils_1.tap)(() => log(`Loaded fallback resource\n\t${name} from\n\t${sourcePath}`)));
}
/** Returns the at-build-time path to the fallback schema file. */
async function fallbackSchema(
/** e.g. themes/section.json */
relativeUri, log) {
    const sourcePath = node_path_1.default.resolve(dataRoot(), node_path_1.default.basename(relativeUri));
    return promises_1.default
        .readFile(sourcePath, 'utf8')
        .then((0, utils_1.tap)(() => log(`Loaded fallback schema\n\t${relativeUri} from\n\t${sourcePath}`)));
}
//# sourceMappingURL=themeLiquidDocsManager.js.map