import {
  AugmentedThemeDocset,
  FileTuple,
  findRoot as findConfigFileRoot,
  isError,
  makeFileExists,
  makeGetDefaultSchemaTranslations,
  makeGetDefaultTranslations,
  makeGetMetafieldDefinitions,
  memoize,
  parseJSON,
  path,
  recursiveReadDirectory,
  SourceCodeType,
  SnippetDefinition,
} from '@shopify/theme-check-common';
import {
  Connection,
  FileChangeType,
  FileOperationRegistrationOptions,
  InitializeResult,
  ShowDocumentRequest,
  TextDocumentSyncKind,
  WorkspaceFolder,
} from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';
import { CodeActionKinds, CodeActionsProvider } from '../codeActions';
import { Commands, ExecuteCommandProvider } from '../commands';
import { CompletionsProvider } from '../completions';
import { GetSnippetNamesForURI } from '../completions/providers/RenderSnippetCompletionProvider';
import { DiagnosticsManager, makeRunChecks } from '../diagnostics';
import { DocumentHighlightsProvider } from '../documentHighlights/DocumentHighlightsProvider';
import { DocumentLinksProvider } from '../documentLinks';
import { DocumentManager } from '../documents';
import { OnTypeFormattingProvider } from '../formatting';
import { HoverProvider } from '../hover';
import { JSONLanguageService } from '../json/JSONLanguageService';
import { LinkedEditingRangesProvider } from '../linkedEditingRanges/LinkedEditingRangesProvider';
import { RenameProvider } from '../rename/RenameProvider';
import { RenameHandler } from '../renamed/RenameHandler';
import { GetTranslationsForURI } from '../translations';
import { Dependencies } from '../types';
import { debounce } from '../utils';
import { snippetName } from '../utils/uri';
import { VERSION } from '../version';
import { CachedFileSystem } from './CachedFileSystem';
import { Configuration } from './Configuration';
import { safe } from './safe';

const defaultLogger = () => {};

/**
 * The `git:` VFS does not support the `fs.readDirectory` call and makes most things break.
 * `git` URIs are the ones you'd encounter when doing a git diff in VS Code. They're not
 * real files, they're just a way to represent changes in a git repository. As such, I don't
 * think we want to sync those in our document manager or try to offer document links, etc.
 *
 * A middleware would be nice but it'd be a bit of a pain to implement.
 */
const hasUnsupportedDocument = (params: any) => {
  return (
    'textDocument' in params &&
    'uri' in params.textDocument &&
    typeof params.textDocument.uri === 'string' &&
    params.textDocument.uri.startsWith('git:')
  );
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
export function startServer(
  connection: Connection,
  {
    fs: injectedFs,
    loadConfig,
    log = defaultLogger,
    jsonValidationSet,
    themeDocset: remoteThemeDocset,
    fetchMetafieldDefinitionsForURI,
  }: Dependencies,
) {
  const fs = new CachedFileSystem(injectedFs);
  const fileExists = makeFileExists(fs);
  const clientCapabilities = new ClientCapabilities();
  const configuration = new Configuration(connection, clientCapabilities);
  const documentManager: DocumentManager = new DocumentManager(
    fs,
    connection,
    clientCapabilities,
    getModeForURI,
    isValidSchema,
  );
  const diagnosticsManager = new DiagnosticsManager(connection);
  const documentLinksProvider = new DocumentLinksProvider(documentManager, findThemeRootURI);
  const codeActionsProvider = new CodeActionsProvider(documentManager, diagnosticsManager);
  const onTypeFormattingProvider = new OnTypeFormattingProvider(
    documentManager,
    async function setCursorPosition(textDocument, position) {
      if (!clientCapabilities.hasShowDocumentSupport) return;
      connection.sendRequest(ShowDocumentRequest.type, {
        uri: textDocument.uri,
        takeFocus: true,
        selection: {
          start: position,
          end: position,
        },
      });
    },
  );
  const linkedEditingRangesProvider = new LinkedEditingRangesProvider(documentManager);
  const documentHighlightProvider = new DocumentHighlightsProvider(documentManager);
  const renameProvider = new RenameProvider(
    connection,
    clientCapabilities,
    documentManager,
    findThemeRootURI,
  );
  const renameHandler = new RenameHandler(
    connection,
    clientCapabilities,
    documentManager,
    findThemeRootURI,
  );

  async function findThemeRootURI(uri: string) {
    const rootUri = await findConfigFileRoot(uri, fileExists);
    const config = await loadConfig(rootUri, fs);
    return config.rootUri;
  }

  const getMetafieldDefinitionsForRootUri = memoize(
    makeGetMetafieldDefinitions(fs),
    (rootUri: string) => rootUri,
  );

  const getMetafieldDefinitions = async (uri: string) => {
    const rootUri = await findThemeRootURI(uri);

    return getMetafieldDefinitionsForRootUri(rootUri);
  };

  // These are augmented here so that the caching is maintained over different runs.
  const themeDocset = new AugmentedThemeDocset(remoteThemeDocset);
  const runChecks = debounce(
    makeRunChecks(documentManager, diagnosticsManager, {
      fs,
      loadConfig,
      themeDocset,
      jsonValidationSet,
      getMetafieldDefinitions,
    }),
    100,
  );

  const getTranslationsForURI: GetTranslationsForURI = async (uri) => {
    const rootURI = await findThemeRootURI(uri);
    const theme = documentManager.theme(rootURI);
    const getDefaultTranslations = makeGetDefaultTranslations(fs, theme, rootURI);
    const [defaultTranslations, shopifyTranslations] = await Promise.all([
      getDefaultTranslations(),
      themeDocset.systemTranslations(),
    ]);

    return { ...shopifyTranslations, ...defaultTranslations };
  };

  const getSchemaTranslationsForURI: GetTranslationsForURI = async (uri) => {
    const rootURI = await findThemeRootURI(uri);
    const theme = documentManager.theme(rootURI);
    const getDefaultSchemaTranslations = makeGetDefaultSchemaTranslations(fs, theme, rootURI);
    return getDefaultSchemaTranslations();
  };

  const getSnippetDefinitionForURI = async (
    uri: string,
    snippetName: string,
  ): Promise<SnippetDefinition | undefined> => {
    const rootUri = await findThemeRootURI(uri);
    const snippetURI = path.join(rootUri, 'snippets', `${snippetName}.liquid`);
    const snippet = documentManager.get(snippetURI);

    if (!snippet || snippet.type !== SourceCodeType.LiquidHtml || isError(snippet.ast)) {
      return undefined;
    }

    return snippet.getLiquidDoc(snippetName);
  };

  const snippetFilter = ([uri]: FileTuple) => /\.liquid$/.test(uri) && /snippets/.test(uri);
  const getSnippetNamesForURI: GetSnippetNamesForURI = safe(async (uri: string) => {
    const rootUri = await findThemeRootURI(uri);
    const snippetUris = await recursiveReadDirectory(fs, rootUri, snippetFilter);
    return snippetUris.map(snippetName);
  }, []);

  const getThemeSettingsSchemaForURI = safe(async (uri: string) => {
    const rootUri = await findThemeRootURI(uri);
    const settingsSchemaUri = path.join(rootUri, 'config', 'settings_schema.json');
    const contents = await fs.readFile(settingsSchemaUri);
    const json = parseJSON(contents);
    if (isError(json) || !Array.isArray(json)) {
      throw new Error('Settings JSON file not in correct format');
    }
    return json;
  }, []);

  async function getModeForURI(uri: string) {
    const rootUri = await findConfigFileRoot(uri, fileExists);
    const config = await loadConfig(rootUri, fs);
    return config.context;
  }

  const getThemeBlockNames = safe(async (uri: string, includePrivate: boolean) => {
    const rootUri = await findThemeRootURI(uri);
    const blocks = await fs.readDirectory(path.join(rootUri, 'blocks'));
    const blockNames = blocks.map(([uri]) => path.basename(uri, '.liquid'));

    if (includePrivate) {
      return blockNames;
    }

    return blockNames.filter((blockName) => !blockName.startsWith('_'));
  }, []);

  async function getThemeBlockSchema(uri: string, name: string) {
    const rootUri = await findThemeRootURI(uri);
    const blockUri = path.join(rootUri, 'blocks', `${name}.liquid`);
    const doc = documentManager.get(blockUri);
    if (!doc || doc.type !== SourceCodeType.LiquidHtml) {
      return;
    }
    return doc.getSchema();
  }

  // Defined as a function to solve a circular dependency (doc manager & json
  // lang service both need each other)
  async function isValidSchema(uri: string, jsonString: string) {
    return jsonLanguageService.isValidSchema(uri, jsonString);
  }

  const jsonLanguageService = new JSONLanguageService(
    documentManager,
    jsonValidationSet,
    getSchemaTranslationsForURI,
    getModeForURI,
    getThemeBlockNames,
    getThemeBlockSchema,
  );
  const completionsProvider = new CompletionsProvider({
    documentManager,
    themeDocset,
    getTranslationsForURI,
    getSnippetNamesForURI,
    getThemeSettingsSchemaForURI,
    log,
    getThemeBlockNames,
    getMetafieldDefinitions,
    getSnippetDefinitionForURI,
  });
  const hoverProvider = new HoverProvider(
    documentManager,
    themeDocset,
    getMetafieldDefinitions,
    getTranslationsForURI,
    getThemeSettingsSchemaForURI,
    getSnippetDefinitionForURI,
  );

  const executeCommandProvider = new ExecuteCommandProvider(
    documentManager,
    diagnosticsManager,
    clientCapabilities,
    runChecks,
    connection,
  );

  const fetchMetafieldDefinitionsForWorkspaceFolders = async (folders: WorkspaceFolder[]) => {
    if (!fetchMetafieldDefinitionsForURI) return;

    for (let folder of folders) {
      try {
        const mode = await getModeForURI(folder.uri);

        if (mode === 'theme') {
          fetchMetafieldDefinitionsForURI(folder.uri);
        }
      } catch (_err) {
        // ignore if we can't find mode for folder uri
      }
    }
  };

  connection.onInitialize((params) => {
    clientCapabilities.setup(params.capabilities, params.initializationOptions);
    jsonLanguageService.setup(params.capabilities);
    configuration.setup();

    const fileOperationRegistrationOptions: FileOperationRegistrationOptions = {
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

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: {
          change: TextDocumentSyncKind.Full,
          save: true,
          openClose: true,
        },
        codeActionProvider: {
          codeActionKinds: [...CodeActionKinds],
        },
        completionProvider: {
          triggerCharacters: ['.', '{{ ', '{% ', '<', '/', '[', '"', "'", ':', '@'],
        },
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
          commands: [...Commands],
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
        version: VERSION,
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
        if (!folders) return;

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
    if (hasUnsupportedDocument(params)) return;
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
      documentManager.preload(rootUri);
    }
  });

  connection.onDidChangeTextDocument(async (params) => {
    if (hasUnsupportedDocument(params)) return;
    const { uri, version } = params.textDocument;
    documentManager.change(uri, params.contentChanges[0].text, version);
    if (await configuration.shouldCheckOnChange()) {
      runChecks([uri]);
    } else {
      // The diagnostics may be stale! Clear em!
      diagnosticsManager.clear(params.textDocument.uri);
    }
  });

  connection.onDidSaveTextDocument(async (params) => {
    if (hasUnsupportedDocument(params)) return;
    const { uri } = params.textDocument;
    if (await configuration.shouldCheckOnSave()) {
      runChecks([uri]);
    }
  });

  connection.onDidCloseTextDocument((params) => {
    if (hasUnsupportedDocument(params)) return;
    const { uri } = params.textDocument;
    documentManager.close(uri);
    diagnosticsManager.clear(uri);
  });

  connection.onDocumentLinks(async (params) => {
    if (hasUnsupportedDocument(params)) return [];
    return documentLinksProvider.documentLinks(params.textDocument.uri);
  });

  connection.onCodeAction(async (params) => {
    return codeActionsProvider.codeActions(params);
  });

  connection.onExecuteCommand(async (params) => {
    await executeCommandProvider.execute(params);
  });

  connection.onCompletion(async (params) => {
    if (hasUnsupportedDocument(params)) return [];
    return (
      (await jsonLanguageService.completions(params)) ??
      (await completionsProvider.completions(params))
    );
  });

  connection.onHover(async (params) => {
    if (hasUnsupportedDocument(params)) return null;
    return (await jsonLanguageService.hover(params)) ?? (await hoverProvider.hover(params));
  });

  connection.onDocumentOnTypeFormatting(async (params) => {
    if (hasUnsupportedDocument(params)) return null;
    return onTypeFormattingProvider.onTypeFormatting(params);
  });

  connection.onDocumentHighlight(async (params) => {
    if (hasUnsupportedDocument(params)) return [];
    return documentHighlightProvider.documentHighlights(params);
  });

  connection.onPrepareRename(async (params) => {
    if (hasUnsupportedDocument(params)) return null;
    return renameProvider.prepare(params);
  });

  connection.onRenameRequest(async (params) => {
    if (hasUnsupportedDocument(params)) return null;
    return renameProvider.rename(params);
  });

  connection.languages.onLinkedEditingRange(async (params) => {
    if (hasUnsupportedDocument(params)) return null;
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
      fs.readDirectory.invalidate(path.dirname(oldUri));
      fs.readDirectory.invalidate(path.dirname(newUri));

      // When a file is renamed, readFile and stat for both the old and new URIs are invalidated.
      fs.readFile.invalidate(oldUri);
      fs.readFile.invalidate(newUri);
      fs.stat.invalidate(oldUri);
      fs.stat.invalidate(newUri);
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
    if (params.changes.length === 0) return;

    const triggerUris = params.changes.map((change) => change.uri);
    const updates: Promise<any>[] = [];
    for (const change of params.changes) {
      // Rename cache invalidation is handled by onDidRenameFiles
      if (documentManager.hasRecentRename(change.uri)) {
        documentManager.clearRecentRename(change.uri);
        continue;
      }

      switch (change.type) {
        case FileChangeType.Created:
          // A created file invalidates readDirectory, readFile and stat
          fs.readDirectory.invalidate(path.dirname(change.uri));
          fs.readFile.invalidate(change.uri);
          fs.stat.invalidate(change.uri);
          // If a file is created under out feet, we update its contents.
          updates.push(documentManager.changeFromDisk(change.uri));
          break;

        case FileChangeType.Changed:
          // A changed file invalidates readFile and stat (but not readDirectory)
          fs.readFile.invalidate(change.uri);
          fs.stat.invalidate(change.uri);
          // If the file is not open, we update its contents in the doc manager
          // If it is open, then we don't need to update it because the document manager
          // will have the version from the editor.
          if (documentManager.get(change.uri)?.version === undefined) {
            updates.push(documentManager.changeFromDisk(change.uri));
          }
          break;

        case FileChangeType.Deleted:
          // A deleted file invalides readDirectory, readFile, and stat
          fs.readDirectory.invalidate(path.dirname(change.uri));
          fs.readFile.invalidate(change.uri);
          fs.stat.invalidate(change.uri);
          // If a file is deleted, it's removed from the document manager
          documentManager.delete(change.uri);
          break;
      }

      if (change.uri.endsWith('metafields.json')) {
        updates.push(
          findThemeRootURI(change.uri).then((rootUri) =>
            getMetafieldDefinitionsForRootUri.invalidate(rootUri),
          ),
        );
      }
    }

    await Promise.all(updates);

    // MissingAssets/MissingSnippet should be rerun when a file is deleted
    // since an error might be introduced (and vice versa).
    runChecks.force(triggerUris);
  });

  connection.listen();
}
