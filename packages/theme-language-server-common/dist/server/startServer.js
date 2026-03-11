"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_1 = require("vscode-languageserver");
const ClientCapabilities_1 = require("../ClientCapabilities");
const codeActions_1 = require("../codeActions");
const commands_1 = require("../commands");
const completions_1 = require("../completions");
const CSSLanguageService_1 = require("../css/CSSLanguageService");
const DefinitionProvider_1 = require("../definitions/DefinitionProvider");
const diagnostics_1 = require("../diagnostics");
const DocumentHighlightsProvider_1 = require("../documentHighlights/DocumentHighlightsProvider");
const documentLinks_1 = require("../documentLinks");
const documents_1 = require("../documents");
const formatting_1 = require("../formatting");
const hover_1 = require("../hover");
const JSONLanguageService_1 = require("../json/JSONLanguageService");
const LinkedEditingRangesProvider_1 = require("../linkedEditingRanges/LinkedEditingRangesProvider");
const RenameProvider_1 = require("../rename/RenameProvider");
const RenameHandler_1 = require("../renamed/RenameHandler");
const types_1 = require("../types");
const utils_1 = require("../utils");
const uri_1 = require("../utils/uri");
const version_1 = require("../version");
const CachedFileSystem_1 = require("./CachedFileSystem");
const Configuration_1 = require("./Configuration");
const safe_1 = require("./safe");
const ThemeGraphManager_1 = require("./ThemeGraphManager");
const defaultLogger = () => { };
/**
 * The `git:` VFS does not support the `fs.readDirectory` call and makes most things break.
 * `git` URIs are the ones you'd encounter when doing a git diff in VS Code. They're not
 * real files, they're just a way to represent changes in a git repository. As such, I don't
 * think we want to sync those in our document manager or try to offer document links, etc.
 *
 * A middleware would be nice but it'd be a bit of a pain to implement.
 */
const hasUnsupportedDocument = (params) => {
    return ('textDocument' in params &&
        'uri' in params.textDocument &&
        typeof params.textDocument.uri === 'string' &&
        (params.textDocument.uri.startsWith('jj:') ||
            params.textDocument.uri.startsWith('git:') ||
            params.textDocument.uri.startsWith('output:')));
};
/**
 * This code runs in node and the browser, it can't talk to the file system
 * or make requests. Stuff like that should be injected.
 *
 * In browser, theme-check-js wants these things:
 *   - fileExists(path)
 *   - defaultTranslations
 *
 * Which means we gotta provide 'em from here too!
 */
function startServer(connection, { fs: injectedFs, loadConfig: injectedLoadConfig, log = defaultLogger, jsonValidationSet, themeDocset: remoteThemeDocset, fetchMetafieldDefinitionsForURI, }) {
    const fs = new CachedFileSystem_1.CachedFileSystem(injectedFs);
    const fileExists = (0, theme_check_common_1.makeFileExists)(fs);
    const loadConfig = (0, theme_check_common_1.memoize)(injectedLoadConfig, (uri) => uri);
    const clientCapabilities = new ClientCapabilities_1.ClientCapabilities();
    const configuration = new Configuration_1.Configuration(connection, clientCapabilities);
    const documentManager = new documents_1.DocumentManager(fs, connection, clientCapabilities, getModeForURI, isValidSchema);
    const themeGraphManager = new ThemeGraphManager_1.ThemeGraphManager(connection, documentManager, fs, findThemeRootURI);
    const diagnosticsManager = new diagnostics_1.DiagnosticsManager(connection);
    const documentLinksProvider = new documentLinks_1.DocumentLinksProvider(documentManager, findThemeRootURI);
    const codeActionsProvider = new codeActions_1.CodeActionsProvider(documentManager, diagnosticsManager);
    const onTypeFormattingProvider = new formatting_1.OnTypeFormattingProvider(documentManager, async function setCursorPosition(textDocument, position) {
        if (!clientCapabilities.hasShowDocumentSupport)
            return;
        connection.sendRequest(vscode_languageserver_1.ShowDocumentRequest.type, {
            uri: textDocument.uri,
            takeFocus: true,
            selection: {
                start: position,
                end: position,
            },
        });
    });
    const linkedEditingRangesProvider = new LinkedEditingRangesProvider_1.LinkedEditingRangesProvider(documentManager);
    const documentHighlightProvider = new DocumentHighlightsProvider_1.DocumentHighlightsProvider(documentManager);
    const renameProvider = new RenameProvider_1.RenameProvider(connection, clientCapabilities, documentManager, findThemeRootURI);
    const renameHandler = new RenameHandler_1.RenameHandler(connection, clientCapabilities, documentManager, findThemeRootURI);
    async function findThemeRootURI(uri) {
        const rootUri = await (0, theme_check_common_1.findRoot)(uri, fileExists);
        if (!rootUri)
            return null;
        const config = await loadConfig(rootUri, fs);
        return config.rootUri;
    }
    const getMetafieldDefinitionsForRootUri = (0, theme_check_common_1.memoize)((0, theme_check_common_1.makeGetMetafieldDefinitions)(fs), (rootUri) => rootUri);
    const getMetafieldDefinitions = async (uri) => {
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri) {
            return {};
        }
        return getMetafieldDefinitionsForRootUri(rootUri);
    };
    // These are augmented here so that the caching is maintained over different runs.
    const themeDocset = new theme_check_common_1.AugmentedThemeDocset(remoteThemeDocset);
    const cssLanguageService = new CSSLanguageService_1.CSSLanguageService(documentManager);
    const runChecks = (0, utils_1.debounce)((0, diagnostics_1.makeRunChecks)(documentManager, diagnosticsManager, {
        fs,
        loadConfig,
        themeDocset,
        jsonValidationSet,
        getMetafieldDefinitions,
        cssLanguageService,
        themeGraphManager,
    }), 100);
    const getTranslationsForURI = async (uri) => {
        const rootURI = await findThemeRootURI(uri);
        if (!rootURI)
            return {};
        const theme = documentManager.theme(rootURI);
        const getDefaultTranslations = (0, theme_check_common_1.makeGetDefaultTranslations)(fs, theme, rootURI);
        const [defaultTranslations, shopifyTranslations] = await Promise.all([
            getDefaultTranslations(),
            themeDocset.systemTranslations(),
        ]);
        return { ...shopifyTranslations, ...defaultTranslations };
    };
    const getSchemaTranslationsForURI = async (uri) => {
        const rootURI = await findThemeRootURI(uri);
        if (!rootURI)
            return {};
        const theme = documentManager.theme(rootURI);
        const getDefaultSchemaTranslations = (0, theme_check_common_1.makeGetDefaultSchemaTranslations)(fs, theme, rootURI);
        return getDefaultSchemaTranslations();
    };
    const getDocDefinitionForURI = async (uri, category, name) => {
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri)
            return undefined;
        const fileUri = theme_check_common_1.path.join(rootUri, category, `${name}.liquid`);
        const file = documentManager.get(fileUri);
        if (!file || file.type !== theme_check_common_1.SourceCodeType.LiquidHtml || (0, theme_check_common_1.isError)(file.ast)) {
            return undefined;
        }
        return file.getLiquidDoc();
    };
    const snippetFilter = ([uri]) => /\.liquid$/.test(uri) && /snippets/.test(uri);
    const getSnippetNamesForURI = (0, safe_1.safe)(async (uri) => {
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri)
            return [];
        const snippetUris = await (0, theme_check_common_1.recursiveReadDirectory)(fs, rootUri, snippetFilter);
        return snippetUris.map(uri_1.snippetName);
    }, []);
    const getThemeSettingsSchemaForURI = (0, safe_1.safe)(async (uri) => {
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri)
            return [];
        const settingsSchemaUri = theme_check_common_1.path.join(rootUri, 'config', 'settings_schema.json');
        const contents = await fs.readFile(settingsSchemaUri);
        const json = (0, theme_check_common_1.parseJSON)(contents);
        if ((0, theme_check_common_1.isError)(json) || !Array.isArray(json)) {
            throw new Error('Settings JSON file not in correct format');
        }
        return json;
    }, []);
    async function getModeForURI(uri) {
        const rootUri = await (0, theme_check_common_1.findRoot)(uri, fileExists);
        if (!rootUri)
            return 'theme';
        const config = await loadConfig(rootUri, fs);
        return config.context;
    }
    const getThemeBlockNames = (0, safe_1.safe)(async (uri, includePrivate) => {
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri)
            return [];
        const blocks = await fs.readDirectory(theme_check_common_1.path.join(rootUri, 'blocks'));
        const blockNames = blocks.map(([uri]) => theme_check_common_1.path.basename(uri, '.liquid'));
        if (includePrivate) {
            return blockNames;
        }
        return blockNames.filter((blockName) => !blockName.startsWith('_'));
    }, []);
    async function getThemeBlockSchema(uri, name) {
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri)
            return;
        const blockUri = theme_check_common_1.path.join(rootUri, 'blocks', `${name}.liquid`);
        const doc = documentManager.get(blockUri);
        if (!doc || doc.type !== theme_check_common_1.SourceCodeType.LiquidHtml) {
            return;
        }
        return doc.getSchema();
    }
    // Defined as a function to solve a circular dependency (doc manager & json
    // lang service both need each other)
    async function isValidSchema(uri, jsonString) {
        return jsonLanguageService.isValidSchema(uri, jsonString);
    }
    const getDefaultLocaleFileUri = (0, theme_check_common_1.makeGetDefaultLocaleFileUri)(fs);
    async function getDefaultLocaleSourceCode(uri) {
        var _a;
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri)
            return null;
        const defaultLocaleFileUri = await getDefaultLocaleFileUri(rootUri);
        if (!defaultLocaleFileUri)
            return null;
        return (_a = documentManager.get(defaultLocaleFileUri)) !== null && _a !== void 0 ? _a : null;
    }
    const getDefaultSchemaLocaleFileUri = (0, theme_check_common_1.makeGetDefaultSchemaLocaleFileUri)(fs);
    async function getDefaultSchemaLocaleSourceCode(uri) {
        var _a;
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri)
            return null;
        const defaultLocaleFileUri = await getDefaultSchemaLocaleFileUri(rootUri);
        if (!defaultLocaleFileUri)
            return null;
        return (_a = documentManager.get(defaultLocaleFileUri)) !== null && _a !== void 0 ? _a : null;
    }
    const definitionsProvider = new DefinitionProvider_1.DefinitionProvider(documentManager, getDefaultLocaleSourceCode, getDefaultSchemaLocaleSourceCode);
    const jsonLanguageService = new JSONLanguageService_1.JSONLanguageService(documentManager, jsonValidationSet, getSchemaTranslationsForURI, getModeForURI, getThemeBlockNames, getThemeBlockSchema, findThemeRootURI);
    const completionsProvider = new completions_1.CompletionsProvider({
        documentManager,
        themeDocset,
        getTranslationsForURI,
        getSnippetNamesForURI,
        getThemeSettingsSchemaForURI,
        log,
        getThemeBlockNames,
        getMetafieldDefinitions,
        getDocDefinitionForURI,
    });
    const hoverProvider = new hover_1.HoverProvider(documentManager, themeDocset, getMetafieldDefinitions, getTranslationsForURI, getThemeSettingsSchemaForURI, getDocDefinitionForURI);
    const executeCommandProvider = new commands_1.ExecuteCommandProvider(documentManager, diagnosticsManager, clientCapabilities, runChecks, connection);
    const fetchMetafieldDefinitionsForWorkspaceFolders = async (folders) => {
        if (!fetchMetafieldDefinitionsForURI)
            return;
        for (let folder of folders) {
            const mode = await getModeForURI(folder.uri);
            if (mode === 'theme') {
                fetchMetafieldDefinitionsForURI(folder.uri);
            }
        }
    };
    connection.onInitialize((params) => {
        clientCapabilities.setup(params.capabilities, params.initializationOptions);
        cssLanguageService.setup(params.capabilities);
        jsonLanguageService.setup(params.capabilities);
        configuration.setup();
        const fileOperationRegistrationOptions = {
            filters: [
                {
                    pattern: {
                        glob: '**/*.{liquid,json}',
                    },
                },
                {
                    pattern: {
                        glob: '**/assets/*',
                    },
                },
            ],
        };
        const result = {
            capabilities: {
                textDocumentSync: {
                    change: vscode_languageserver_1.TextDocumentSyncKind.Full,
                    save: true,
                    openClose: true,
                },
                codeActionProvider: {
                    codeActionKinds: [...codeActions_1.CodeActionKinds],
                },
                completionProvider: {
                    triggerCharacters: ['.', '{{ ', '{% ', '<', '/', '[', '"', "'", ':', '@'],
                },
                definitionProvider: true,
                documentOnTypeFormattingProvider: {
                    firstTriggerCharacter: ' ',
                    moreTriggerCharacter: ['{', '%', '-', '>'],
                },
                documentLinkProvider: {
                    resolveProvider: false,
                    workDoneProgress: false,
                },
                documentHighlightProvider: true,
                linkedEditingRangeProvider: true,
                renameProvider: {
                    prepareProvider: true,
                },
                executeCommandProvider: {
                    commands: [...commands_1.Commands],
                },
                hoverProvider: {
                    workDoneProgress: false,
                },
                workspace: {
                    workspaceFolders: {
                        supported: true,
                        changeNotifications: true,
                    },
                    fileOperations: {
                        didRename: fileOperationRegistrationOptions,
                    },
                },
            },
            serverInfo: {
                name: 'theme-language-server',
                version: version_1.VERSION,
            },
        };
        return result;
    });
    connection.onInitialized(() => {
        log(`[SERVER] Let's roll!`);
        configuration.fetchConfiguration();
        configuration.registerDidChangeCapability();
        configuration.registerDidChangeWatchedFilesNotification({
            watchers: [
                {
                    globPattern: '**/.theme-check.yml',
                },
                {
                    globPattern: '**/.shopify/*',
                },
                {
                    globPattern: '**/*.liquid',
                },
                {
                    globPattern: '**/{locales,sections,templates,customers}/*.json',
                },
                {
                    globPattern: '**/config/settings_{data,schema}.json',
                },
            ],
        });
        if (clientCapabilities.hasWorkspaceFoldersSupport) {
            connection.workspace.getWorkspaceFolders().then(async (folders) => {
                if (!folders)
                    return;
                fetchMetafieldDefinitionsForWorkspaceFolders(folders);
            });
            connection.workspace.onDidChangeWorkspaceFolders(async (params) => {
                fetchMetafieldDefinitionsForWorkspaceFolders(params.added);
            });
        }
    });
    connection.onDidChangeConfiguration((_params) => {
        configuration.clearCache();
    });
    connection.onDidOpenTextDocument(async (params) => {
        if (hasUnsupportedDocument(params))
            return;
        const { uri, text, version } = params.textDocument;
        documentManager.open(uri, text, version);
        if (await configuration.shouldCheckOnOpen()) {
            runChecks([uri]);
        }
        // The objective at the time of writing this is to make {Asset,Snippet}Rename
        // fast when you eventually need it.
        //
        // I'm choosing the textDocument/didOpen notification as a hook because
        // I'm not sure we have a better solution than this. Yes we have the
        // initialize request with the workspace folders, but you might have opened
        // an app folder. The root of a theme app extension would probably be
        // at ${workspaceRoot}/extensions/${appExtensionName}. It'd be hard to
        // figure out from the initialize request params.
        //
        // If we open a file that we know is liquid, then we can kind of guarantee
        // we'll find a theme root and we'll preload that.
        if (await configuration.shouldPreloadOnBoot()) {
            const rootUri = await findThemeRootURI(uri);
            if (rootUri) {
                documentManager.preload(rootUri);
            }
        }
    });
    connection.onDidChangeTextDocument(async (params) => {
        if (hasUnsupportedDocument(params))
            return;
        const { uri, version } = params.textDocument;
        documentManager.change(uri, params.contentChanges[0].text, version);
        if (await configuration.shouldCheckOnChange()) {
            runChecks([uri]);
        }
        else {
            // The diagnostics may be stale! Clear em!
            diagnosticsManager.clear(params.textDocument.uri);
        }
    });
    connection.onDidSaveTextDocument(async (params) => {
        if (hasUnsupportedDocument(params))
            return;
        const { uri } = params.textDocument;
        if (await configuration.shouldCheckOnSave()) {
            runChecks([uri]);
        }
    });
    connection.onDidCloseTextDocument((params) => {
        if (hasUnsupportedDocument(params))
            return;
        const { uri } = params.textDocument;
        documentManager.close(uri);
        diagnosticsManager.clear(uri);
    });
    connection.onDocumentLinks(async (params) => {
        if (hasUnsupportedDocument(params))
            return [];
        const [liquidLinks, jsonLinks] = await Promise.all([
            documentLinksProvider.documentLinks(params.textDocument.uri),
            jsonLanguageService.documentLinks(params),
        ]);
        return [...liquidLinks, ...jsonLinks];
    });
    connection.onDefinition(async (params) => {
        if (hasUnsupportedDocument(params))
            return [];
        return definitionsProvider.definitions(params);
    });
    connection.onCodeAction(async (params) => {
        return codeActionsProvider.codeActions(params);
    });
    connection.onExecuteCommand(async (params) => {
        await executeCommandProvider.execute(params);
    });
    connection.onCompletion(async (params) => {
        var _a, _b;
        if (hasUnsupportedDocument(params))
            return [];
        return ((_b = (_a = (await cssLanguageService.completions(params))) !== null && _a !== void 0 ? _a : (await jsonLanguageService.completions(params))) !== null && _b !== void 0 ? _b : (await completionsProvider.completions(params)));
    });
    connection.onHover(async (params) => {
        var _a, _b;
        if (hasUnsupportedDocument(params))
            return null;
        return ((_b = (_a = (await cssLanguageService.hover(params))) !== null && _a !== void 0 ? _a : (await jsonLanguageService.hover(params))) !== null && _b !== void 0 ? _b : (await hoverProvider.hover(params)));
    });
    connection.onDocumentOnTypeFormatting(async (params) => {
        if (hasUnsupportedDocument(params))
            return null;
        return onTypeFormattingProvider.onTypeFormatting(params);
    });
    connection.onDocumentHighlight(async (params) => {
        if (hasUnsupportedDocument(params))
            return [];
        return documentHighlightProvider.documentHighlights(params);
    });
    connection.onPrepareRename(async (params) => {
        if (hasUnsupportedDocument(params))
            return null;
        return renameProvider.prepare(params);
    });
    connection.onRenameRequest(async (params) => {
        if (hasUnsupportedDocument(params))
            return null;
        return renameProvider.rename(params);
    });
    connection.languages.onLinkedEditingRange(async (params) => {
        if (hasUnsupportedDocument(params))
            return null;
        return linkedEditingRangesProvider.linkedEditingRanges(params);
    });
    connection.workspace.onDidRenameFiles(async (params) => {
        const triggerUris = params.files.map((fileRename) => fileRename.newUri);
        // Behold the cache invalidation monster
        for (const { oldUri, newUri } of params.files) {
            // When a file is renamed, we paste the content of the old file into the
            // new file in the document manager. We don't need to invalidate preload
            // because that's the only thing that changed.
            documentManager.rename(oldUri, newUri);
            // When a file is renamed, readDirectory to the parent folder is invalidated.
            fs.readDirectory.invalidate(theme_check_common_1.path.dirname(oldUri));
            fs.readDirectory.invalidate(theme_check_common_1.path.dirname(newUri));
            // When a file is renamed, readFile and stat for both the old and new URIs are invalidated.
            fs.readFile.invalidate(oldUri);
            fs.readFile.invalidate(newUri);
            fs.stat.invalidate(oldUri);
            fs.stat.invalidate(newUri);
            themeGraphManager.rename(oldUri, newUri);
        }
        // We should complete refactors before running theme check
        await renameHandler.onDidRenameFiles(params);
        // MissingAssets/MissingSnippet should be rerun when a file is deleted
        // since the file rename might cause an error.
        runChecks.force(triggerUris);
    });
    /**
     * onDidChangeWatchedFiles is triggered by file operations (in or out of the editor).
     *
     * For in-editor changes, happens redundantly with
     *   - onDidCreateFiles
     *   - onDidRenameFiles
     *   - onDidDeleteFiles
     *   - onDidSaveTextDocument
     *
     * Not redundant for operations that happen outside of the editor
     *   - git pull, checkout, reset, stash pop, etc.
     *   - shopify theme metafields pull
     *   - etc.
     *
     * It always runs and onDid* will never fire without a corresponding onDidChangeWatchedFiles.
     *
     * This is why the bulk of the cache invalidation logic is in this handler.
     */
    connection.onDidChangeWatchedFiles(async (params) => {
        var _a;
        if (params.changes.length === 0)
            return;
        const triggerUris = params.changes.map((change) => change.uri);
        const updates = [];
        for (const change of params.changes) {
            // Theme Check config changes should clear the config cache
            if (change.uri.endsWith('.theme-check.yml')) {
                loadConfig.clearCache();
                continue;
            }
            // Rename cache invalidation is handled by onDidRenameFiles
            if (documentManager.hasRecentRename(change.uri)) {
                documentManager.clearRecentRename(change.uri);
                continue;
            }
            switch (change.type) {
                case vscode_languageserver_1.FileChangeType.Created:
                    // A created file invalidates readDirectory, readFile and stat
                    fs.readDirectory.invalidate(theme_check_common_1.path.dirname(change.uri));
                    fs.readFile.invalidate(change.uri);
                    fs.stat.invalidate(change.uri);
                    themeGraphManager.create(change.uri);
                    // If a file is created under out feet, we update its contents.
                    updates.push(documentManager.changeFromDisk(change.uri));
                    break;
                case vscode_languageserver_1.FileChangeType.Changed:
                    // A changed file invalidates readFile and stat (but not readDirectory)
                    fs.readFile.invalidate(change.uri);
                    fs.stat.invalidate(change.uri);
                    themeGraphManager.change(change.uri);
                    // If the file is not open, we update its contents in the doc manager
                    // If it is open, then we don't need to update it because the document manager
                    // will have the version from the editor.
                    if (((_a = documentManager.get(change.uri)) === null || _a === void 0 ? void 0 : _a.version) === undefined) {
                        updates.push(documentManager.changeFromDisk(change.uri));
                    }
                    break;
                case vscode_languageserver_1.FileChangeType.Deleted:
                    // A deleted file invalides readDirectory, readFile, and stat
                    fs.readDirectory.invalidate(theme_check_common_1.path.dirname(change.uri));
                    fs.readFile.invalidate(change.uri);
                    fs.stat.invalidate(change.uri);
                    themeGraphManager.delete(change.uri);
                    // If a file is deleted, it's removed from the document manager
                    documentManager.delete(change.uri);
                    break;
            }
            if (change.uri.endsWith('metafields.json')) {
                updates.push(findThemeRootURI(change.uri).then((rootUri) => {
                    if (rootUri) {
                        getMetafieldDefinitionsForRootUri.invalidate(rootUri);
                    }
                }));
            }
        }
        await Promise.all(updates);
        // MissingAssets/MissingSnippet should be rerun when a file is deleted
        // since an error might be introduced (and vice versa).
        runChecks.force(triggerUris);
    });
    connection.onRequest(types_1.ThemeGraphReferenceRequest.type, async (params) => {
        if (hasUnsupportedDocument(params))
            return [];
        const { uri, offset, includeIndirect } = params;
        return themeGraphManager.getReferences(uri, offset, { includeIndirect }).catch((_) => []);
    });
    connection.onRequest(types_1.ThemeGraphDependenciesRequest.type, async (params) => {
        if (hasUnsupportedDocument(params))
            return [];
        const { uri, offset, includeIndirect } = params;
        return themeGraphManager.getDependencies(uri, offset, { includeIndirect }).catch((_) => []);
    });
    connection.onRequest(types_1.ThemeGraphRootRequest.type, async (params) => {
        if (hasUnsupportedDocument(params))
            return '';
        const { uri } = params;
        const rootUri = await findThemeRootURI(uri).catch((_) => undefined);
        if (!rootUri || theme_check_common_1.path.dirname(rootUri) === rootUri) {
            console.error(uri);
        }
        return rootUri;
    });
    connection.onRequest(types_1.ThemeGraphDeadCodeRequest.type, async (params) => {
        if (hasUnsupportedDocument(params))
            return [];
        const { uri } = params;
        const rootUri = await findThemeRootURI(uri);
        if (!rootUri)
            return [];
        const deadFiles = await themeGraphManager.deadCode(rootUri);
        return deadFiles;
    });
    connection.onNotification(types_1.SetObjectsNotification.type, ({ uri, objects }) => {
        themeDocset.setObjectsForURI(uri, objects);
    });
    connection.listen();
}
//# sourceMappingURL=startServer.js.map