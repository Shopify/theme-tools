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
} from '@shopify/theme-check-common';
import {
  Connection,
  FileOperationRegistrationOptions,
  InitializeResult,
  ShowDocumentRequest,
  TextDocumentSyncKind,
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
  }: Dependencies,
) {
  const fs = new CachedFileSystem(injectedFs);
  const fileExists = makeFileExists(fs);
  const clientCapabilities = new ClientCapabilities();
  const configuration = new Configuration(connection, clientCapabilities);
  const documentManager = new DocumentManager(fs, connection, clientCapabilities);
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
  const renameProvider = new RenameProvider(documentManager);
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

  const snippetFilter = ([uri]: FileTuple) => /\.liquid$/.test(uri) && /snippets/.test(uri);
  const getSnippetNamesForURI: GetSnippetNamesForURI = async (uri: string) => {
    const rootUri = await findThemeRootURI(uri);
    const snippetUris = await recursiveReadDirectory(fs, rootUri, snippetFilter);
    return snippetUris.map(snippetName);
  };

  const getThemeSettingsSchemaForURI = async (uri: string) => {
    try {
      const rootUri = await findThemeRootURI(uri);
      const settingsSchemaUri = path.join(rootUri, 'config', 'settings_schema.json');
      const contents = await fs.readFile(settingsSchemaUri);
      const json = parseJSON(contents);
      if (isError(json) || !Array.isArray(json)) {
        throw new Error('Settings JSON file not in correct format');
      }
      return json;
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  const getModeForURI = async (uri: string) => {
    const rootUri = await findConfigFileRoot(uri, fileExists);
    const config = await loadConfig(rootUri, fs);
    return config.context;
  };

  const jsonLanguageService = new JSONLanguageService(
    documentManager,
    jsonValidationSet,
    getSchemaTranslationsForURI,
    getModeForURI,
  );
  const completionsProvider = new CompletionsProvider({
    documentManager,
    themeDocset,
    getTranslationsForURI,
    getSnippetNamesForURI,
    getThemeSettingsSchemaForURI,
    log,
    getMetafieldDefinitions,
  });
  const hoverProvider = new HoverProvider(
    documentManager,
    themeDocset,
    getMetafieldDefinitions,
    getTranslationsForURI,
    getThemeSettingsSchemaForURI,
  );

  const executeCommandProvider = new ExecuteCommandProvider(
    documentManager,
    diagnosticsManager,
    clientCapabilities,
    runChecks,
    connection,
  );

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
          triggerCharacters: ['.', '{{ ', '{% ', '<', '/', '[', '"', "'", ':'],
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
          fileOperations: {
            didRename: fileOperationRegistrationOptions,
            didCreate: fileOperationRegistrationOptions,
            didDelete: fileOperationRegistrationOptions,
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
      ],
    });
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
    // I'm not sure we have a better solution that this. Yes we have the
    // initialize request with the workspace folders, but you might have opened
    // an app folder. The root of a theme app extension would probably be
    // at ${workspaceRoot}/extensions/${appExtensionName}. It'd be hard to
    // figure out from the initialize request params.
    //
    // If we open a file that we know is liquid, then we can kind of guarantee
    // we'll find a theme root and we'll preload that.
    findThemeRootURI(uri)
      .then((rootUri) => documentManager.preload(rootUri))
      .catch((e) => console.error(e));
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
    fs.readFile.invalidate(uri);
    fs.stat.invalidate(uri);
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

  connection.onDidChangeWatchedFiles(async (params) => {
    if (params.changes.length === 0) return;

    for (const change of params.changes) {
      fs.readDirectory.invalidate(path.dirname(change.uri));
      fs.readFile.invalidate(change.uri);
      fs.stat.invalidate(change.uri);

      if (change.uri.endsWith('metafields.json')) {
        const rootUri = await findThemeRootURI(change.uri);
        getMetafieldDefinitionsForRootUri.invalidate(rootUri);
      }
    }
  });

  connection.workspace.onDidCreateFiles((params) => {
    const triggerUris = params.files.map((fileCreate) => fileCreate.uri);
    for (const { uri } of params.files) {
      // When a file is created, to make sure preload isn't invalidated, we add
      // an empty string to the document manager for the new URI.
      if (!documentManager.has(uri)) documentManager.open(uri, '', undefined);
      fs.readDirectory.invalidate(path.dirname(uri)); // Since there's a new file there
      fs.readFile.invalidate(uri); // Since this is no longer an error
      fs.stat.invalidate(uri); // Since this is no longer an error
    }

    // MissingAssets/MissingSnippet should be rerun when a new file exists
    // since the file creation might invalidate the error.
    runChecks.force(triggerUris);
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

    // MissingAssets/MissingSnippet should be rerun when a file is renamed
    // since the file rename might invalidate an error.
    runChecks.force(triggerUris);
  });

  connection.workspace.onDidDeleteFiles((params) => {
    const triggerUris = params.files.map((fileDelete) => fileDelete.uri);
    for (const { uri } of params.files) {
      // When a file is deleted, we remove it from the document manager.
      // Don't need to invalidate preload because that operation covers it.
      documentManager.delete(uri);

      // Since the file is gone, we invalidate the parent directory's readDirectory.
      fs.readDirectory.invalidate(path.dirname(uri));

      // Since the file is gone, we invalidate the readFile and stat for the URI.
      fs.readFile.invalidate(uri);
      fs.stat.invalidate(uri);
    }

    // MissingAssets/MissingSnippet should be rerun when a file is deleted
    // since the file rename might cause an error.
    runChecks.force(triggerUris);
  });

  connection.listen();
}
