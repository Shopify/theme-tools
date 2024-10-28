import {
  AugmentedThemeDocset,
  FileTuple,
  findRoot,
  isError,
  makeFileExists,
  makeGetDefaultSchemaTranslations,
  makeGetDefaultTranslations,
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
import { GetTranslationsForURI } from '../translations';
import { Dependencies } from '../types';
import { debounce } from '../utils';
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
  const documentManager = new DocumentManager();
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

  async function findThemeRootURI(uri: string) {
    const rootUri = await findRoot(uri, fileExists);
    const config = await loadConfig(rootUri, fileExists);
    return config.rootUri;
  }

  // These are augmented here so that the caching is maintained over different runs.
  const themeDocset = new AugmentedThemeDocset(remoteThemeDocset);
  const runChecks = debounce(
    makeRunChecks(documentManager, diagnosticsManager, {
      fs,
      loadConfig,
      themeDocset,
      jsonValidationSet,
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
    const files = await recursiveReadDirectory(fs, rootUri, snippetFilter);
    return files.map((uri) =>
      path
        .relative(uri, rootUri)
        .replace(/^snippets\//, '')
        .replace(/\.liquid$/, ''),
    );
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
    const rootUri = await findRoot(uri, fileExists);
    const config = await loadConfig(rootUri, fileExists);
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
  });
  const hoverProvider = new HoverProvider(
    documentManager,
    themeDocset,
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

  // These notifications could cause a MissingSnippet check to be invalidated
  //
  // It is not guaranteed that the file is or was opened when it was
  // created/renamed/deleted. If we're smart, we're going to re-lint for
  // every root affected. Unfortunately, we can't just use the debounced
  // call because we could run in a weird timing issue where didOpen
  // happens after the didRename and causes the 'lastArgs' to skip over the
  // ones we were after.
  //
  // So we're using runChecks.force for that.
  connection.workspace.onDidCreateFiles((params) => {
    const triggerUris = params.files.map((fileCreate) => fileCreate.uri);
    runChecks.force(triggerUris);
    for (const { uri } of params.files) {
      fs.readDirectory.invalidate(path.dirname(uri));
      fs.readFile.invalidate(uri);
      fs.stat.invalidate(uri);
    }
  });
  connection.workspace.onDidRenameFiles((params) => {
    const triggerUris = params.files.map((fileRename) => fileRename.newUri);
    runChecks.force(triggerUris);
    for (const { oldUri, newUri } of params.files) {
      fs.readDirectory.invalidate(path.dirname(oldUri));
      fs.readDirectory.invalidate(path.dirname(newUri));
      fs.readFile.invalidate(oldUri);
      fs.readFile.invalidate(newUri);
      fs.stat.invalidate(oldUri);
      fs.stat.invalidate(newUri);
    }
  });
  connection.workspace.onDidDeleteFiles((params) => {
    const triggerUris = params.files.map((fileDelete) => fileDelete.uri);
    runChecks.force(triggerUris);
    for (const { uri } of params.files) {
      fs.readDirectory.invalidate(path.dirname(uri));
      fs.readFile.invalidate(uri);
      fs.stat.invalidate(uri);
    }
  });

  connection.listen();
}
