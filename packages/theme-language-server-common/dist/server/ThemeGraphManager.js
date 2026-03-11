"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeGraphManager = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const theme_graph_1 = require("@shopify/theme-graph");
const vscode_json_languageservice_1 = require("vscode-json-languageservice");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const types_1 = require("../types");
const utils_1 = require("../utils");
class ThemeGraphManager {
    constructor(connection, documentManager, fs, findThemeRootURI) {
        this.connection = connection;
        this.documentManager = documentManager;
        this.fs = fs;
        this.findThemeRootURI = findThemeRootURI;
        this.graphs = new Map();
        this.operationQueue = [];
        this.processQueue = (0, utils_1.debounce)(async () => {
            const operations = [...new Set(this.operationQueue.splice(0, this.operationQueue.length))];
            if (operations.length === 0)
                return;
            const anyUri = operations[0];
            const rootUri = await this.findThemeRootURI(anyUri);
            if (!rootUri)
                return;
            const graph = await this.graphs.get(rootUri);
            if (!graph)
                return;
            this.graphs.delete(rootUri);
            await this.getThemeGraphForURI(rootUri);
            this.connection.sendNotification(types_1.ThemeGraphDidUpdateNotification.type, { uri: rootUri });
        }, 500);
        this.buildThemeGraph = async (rootUri, entryPoints) => {
            const { documentManager } = this;
            await documentManager.preload(rootUri);
            const dependencies = await this.graphDependencies(rootUri);
            return (0, theme_graph_1.buildThemeGraph)(rootUri, dependencies, entryPoints);
        };
        this.getSourceCode = async (uri) => {
            const doc = this.documentManager.get(uri);
            if (doc)
                return doc;
            const source = await this.fs.readFile(uri);
            return (0, theme_graph_1.toSourceCode)(uri, source);
        };
    }
    async getThemeGraphForURI(uri) {
        const rootUri = await this.findThemeRootURI(uri);
        if (!rootUri) {
            return undefined;
        }
        if (!this.graphs.has(rootUri)) {
            this.graphs.set(rootUri, this.buildThemeGraph(rootUri));
        }
        return this.graphs.get(rootUri);
    }
    async getReferences(uri, offset, { includeIndirect = true, includePreset = true } = {}) {
        const graph = await this.getThemeGraphForURI(uri);
        if (!graph)
            return [];
        const module = graph.modules[uri];
        if (!module)
            return [];
        const includedTypes = [
            'direct',
            includeIndirect ? 'indirect' : undefined,
            includePreset ? 'preset' : undefined,
        ];
        const refs = module.references.filter((dep) => includedTypes.includes(dep.type));
        return Promise.all(refs.map(async (ref) => {
            const [source, target] = await Promise.all([
                this.augmentedLocation(ref.source),
                this.augmentedLocation(ref.target),
            ]);
            return {
                ...ref,
                source: source,
                target: target,
            };
        }));
    }
    async getDependencies(uri, offset, { includeIndirect = true, includePreset = true } = {}) {
        var _a;
        const graph = await this.getThemeGraphForURI(uri);
        if (!graph)
            return [];
        let module = graph.modules[uri];
        if (!module) {
            // If the module is not found, we might be dealing with dead code.
            // dead code doesn't show up in the graph, but it might still have dependencies.
            // So we're building a smaller graph with that file as entry point to figure
            // out what it depends on.
            const deadCodeGraph = await this.buildThemeGraph(graph.rootUri, [uri]);
            module = deadCodeGraph.modules[uri];
        }
        // If the module is still not found, we return an empty array.
        if (!module)
            return [];
        const includedTypes = [
            'direct',
            includeIndirect ? 'indirect' : undefined,
            includePreset ? 'preset' : undefined,
        ];
        const deps = (_a = module.dependencies.filter((dep) => includedTypes.includes(dep.type))) !== null && _a !== void 0 ? _a : [];
        return Promise.all(deps.map(async (dep) => {
            const [source, target] = await Promise.all([
                this.augmentedLocation(dep.source),
                this.augmentedLocation(dep.target),
            ]);
            return {
                ...dep,
                source: source,
                target: target,
            };
        }));
    }
    async augmentedLocation(loc) {
        var _a;
        const sourceCode = await this.getSourceCode(loc.uri).catch(() => undefined);
        const { uri, range } = loc;
        if (!sourceCode || !range)
            return { exists: !!sourceCode, ...loc };
        let doc = (_a = this.documentManager.get(loc.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        if (!doc) {
            doc = vscode_languageserver_textdocument_1.TextDocument.create(sourceCode.uri, sourceCode.type, 0, sourceCode.source);
        }
        return {
            uri: uri,
            range: range,
            excerpt: sourceCode.source.slice(range[0], range[1]),
            position: vscode_json_languageservice_1.Range.create(doc.positionAt(range[0]), doc.positionAt(range[0])),
            exists: true, // implicit since sourceCode exists
        };
    }
    async deadCode(rootUri) {
        const graph = await this.getThemeGraphForURI(rootUri);
        if (!graph)
            return [];
        const files = await (0, theme_check_common_1.recursiveReadDirectory)(this.fs, rootUri, ([uri]) => ['assets', 'blocks', 'layout', 'sections', 'snippets', 'templates'].some((dir) => uri.startsWith(theme_check_common_1.path.join(rootUri, dir))) &&
            (uri.endsWith('.liquid') ||
                uri.endsWith('.json') ||
                uri.endsWith('.js') ||
                uri.endsWith('.css')));
        const unusedFiles = new Set();
        for (const file of files) {
            if (!graph.modules[file]) {
                unusedFiles.add(file);
            }
        }
        return Array.from(unusedFiles).sort();
    }
    async rename(oldUri, newUri) {
        this.operationQueue.push(oldUri);
        this.operationQueue.push(newUri);
        this.processQueue();
    }
    async change(uri) {
        this.operationQueue.push(uri);
        this.processQueue();
    }
    async create(uri) {
        this.operationQueue.push(uri);
        this.processQueue();
    }
    async delete(uri) {
        this.operationQueue.push(uri);
        this.processQueue();
    }
    getWebComponentMap(rootUri) {
        const { fs, getSourceCode } = this;
        return (0, theme_graph_1.getWebComponentMap)(rootUri, { fs, getSourceCode });
    }
    async graphDependencies(rootUri) {
        const { documentManager, fs, getSourceCode } = this;
        const webComponentDefs = await this.getWebComponentMap(rootUri);
        return {
            fs: fs,
            getSourceCode: getSourceCode,
            async getBlockSchema(name) {
                const blockUri = theme_check_common_1.path.join(rootUri, 'blocks', `${name}.liquid`);
                const doc = documentManager.get(blockUri);
                if (!doc || doc.type !== theme_check_common_1.SourceCodeType.LiquidHtml) {
                    return;
                }
                return (await doc.getSchema());
            },
            async getSectionSchema(name) {
                const sectionUri = theme_check_common_1.path.join(rootUri, 'sections', `${name}.liquid`);
                const doc = documentManager.get(sectionUri);
                if (!doc || doc.type !== theme_check_common_1.SourceCodeType.LiquidHtml) {
                    return;
                }
                return (await doc.getSchema());
            },
            getWebComponentDefinitionReference(customElementName) {
                return webComponentDefs.get(customElementName);
            },
        };
    }
}
exports.ThemeGraphManager = ThemeGraphManager;
//# sourceMappingURL=ThemeGraphManager.js.map