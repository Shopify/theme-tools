"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentManager = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const progress_1 = require("../progress");
const theme_check_common_2 = require("@shopify/theme-check-common");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class DocumentManager {
    constructor(fs, connection, clientCapabilities, getModeForUri, isValidSchema) {
        this.fs = fs;
        this.connection = connection;
        this.clientCapabilities = clientCapabilities;
        this.getModeForUri = getModeForUri;
        this.isValidSchema = isValidSchema;
        /**
         * The preload method is used to pre-load and pre-parse all the files in the
         * theme. It is smart and only will load files that are not already in the
         * DocumentManager.
         *
         * Files that are loaded from the AbstractFileSystem will have a version of `undefined`.
         */
        this.preload = (0, theme_check_common_1.memoize)(async (rootUri) => {
            if (!this.fs)
                throw new Error('Cannot call preload without a FileSystem');
            const { fs, connection, clientCapabilities } = this;
            const progress = progress_1.Progress.create(connection, clientCapabilities, `preload#${rootUri}`);
            progress.start('Initializing Liquid LSP');
            // We'll only load the files that aren't already in the store. No need to
            // parse a file we already parsed.
            const filesToLoad = await (0, theme_check_common_1.recursiveReadDirectory)(this.fs, rootUri, ([uri]) => /\.(liquid|json)$/.test(uri) && !this.sourceCodes.has(uri));
            progress.report(10, 'Preloading files');
            let [i, n] = [0, filesToLoad.length];
            await Promise.all(filesToLoad.map(async (file) => {
                // This is what is important, we are loading the file from the file system
                // And setting their initial version to `undefined` to mean "on disk".
                try {
                    this.set(file, await fs.readFile(file), undefined);
                }
                catch (error) {
                    console.error('Failed to preload', file, error);
                }
                // This is just doing progress reporting
                if (++i % 10 === 0) {
                    const message = `Preloading files [${i}/${n}]`;
                    progress.report((0, progress_1.percent)(i, n, 10), message);
                }
            }));
            progress.end('Completed');
        }, (rootUri) => rootUri);
        this.sourceCodes = new Map();
        this.recentlyRenamed = new Set();
    }
    open(uri, source, version) {
        return this.set(uri, source, version);
    }
    change(uri, source, version) {
        return this.set(uri, source, version);
    }
    async changeFromDisk(uri) {
        if (!this.fs)
            throw new Error('Cannot call changeFromDisk without a FileSystem');
        this.change(uri, await this.fs.readFile(uri), undefined);
    }
    close(uri) {
        const sourceCode = this.sourceCodes.get(uri);
        if (!sourceCode)
            return;
        return this.set(uri, sourceCode.source, undefined);
    }
    delete(uri) {
        return this.sourceCodes.delete(uri);
    }
    rename(oldUri, newUri) {
        this.trackRename(oldUri, newUri);
        const sourceCode = this.sourceCodes.get(oldUri);
        if (!sourceCode)
            return;
        this.sourceCodes.delete(oldUri);
        this.set(newUri, sourceCode.source, sourceCode.version);
    }
    theme(root, includeFilesFromDisk = false) {
        return [...this.sourceCodes.values()]
            .filter((sourceCode) => sourceCode.uri.startsWith(root))
            .filter((sourceCode) => includeFilesFromDisk || sourceCode.version !== undefined);
    }
    get openDocuments() {
        return [...this.sourceCodes.values()].filter((sourceCode) => sourceCode.version !== undefined);
    }
    get(uri) {
        return this.sourceCodes.get(theme_check_common_1.path.normalize(uri));
    }
    has(uri) {
        return this.sourceCodes.has(theme_check_common_1.path.normalize(uri));
    }
    /** Used to prevent cache busting twice for the same operation */
    hasRecentRename(uri) {
        return this.recentlyRenamed.has(uri);
    }
    clearRecentRename(uri) {
        this.recentlyRenamed.delete(uri);
    }
    set(uri, source, version) {
        uri = theme_check_common_1.path.normalize(uri);
        // We only support json and liquid files.
        if (!/\.(json|liquid)$/.test(uri) || /\.(s?css|js).liquid$/.test(uri)) {
            return;
        }
        this.sourceCodes.set(uri, this.augmentedSourceCode(uri, source, version));
    }
    augmentedSourceCode(uri, source, version) {
        var _a;
        const sourceCode = (0, theme_check_common_1.toSourceCode)(uri, source, version);
        const textDocument = vscode_languageserver_textdocument_1.TextDocument.create(uri, sourceCode.type, (_a = sourceCode.version) !== null && _a !== void 0 ? _a : 0, // create doesn't let us put undefined here.
        sourceCode.source);
        switch (sourceCode.type) {
            case theme_check_common_1.SourceCodeType.JSON:
                return {
                    ...sourceCode,
                    textDocument,
                };
            case theme_check_common_1.SourceCodeType.LiquidHtml:
                return {
                    ...sourceCode,
                    textDocument,
                    /** Lazy and only computed once per file version */
                    getSchema: (0, theme_check_common_1.memo)(async () => {
                        if (!this.getModeForUri || !this.isValidSchema)
                            return undefined;
                        const mode = await this.getModeForUri(uri);
                        return (0, theme_check_common_1.toSchema)(mode, uri, sourceCode, this.isValidSchema, false);
                    }),
                    /** Lazy and only computed once per file version */
                    getLiquidDoc: (0, theme_check_common_1.memo)(async () => {
                        const ast = sourceCode.ast;
                        if ((0, theme_check_common_1.isError)(ast))
                            return undefined;
                        return (0, theme_check_common_2.extractDocDefinition)(uri, ast);
                    }),
                };
            default:
                return (0, theme_check_common_1.assertNever)(sourceCode);
        }
    }
    /**
     * The workspace/onDidRenameFile notification is sent when a file is renamed in the workspace (via a user gesture)
     * The workspace/onDidChangeWatchedFiles notification is sent when a file is renamed on disk (via a file system event)
     *
     * The order is not guaranteed, but it seems to be true that onDidRenameFile happens before onDidChangeWatchedFiles.
     *
     * In the off-chance that the order is reversed, we'll have the sleep timer to clean up the state.
     */
    trackRename(oldUri, newUri) {
        this.recentlyRenamed.add(oldUri);
        this.recentlyRenamed.add(newUri);
        sleep(2000).then(() => {
            this.clearRecentRename(oldUri);
            this.clearRecentRename(newUri);
        });
    }
}
exports.DocumentManager = DocumentManager;
//# sourceMappingURL=DocumentManager.js.map