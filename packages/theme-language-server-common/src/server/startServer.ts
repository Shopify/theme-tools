import { AugmentedSchemaValidators, AugmentedThemeDocset } from '@shopify/theme-check-common';
import {
  Connection,
  DidCreateFilesNotification,
  DidDeleteFilesNotification,
  DidRenameFilesNotification,
  FileOperationRegistrationOptions,
  InitializeResult,
  TextDocumentSyncKind,
} from 'vscode-languageserver';
import { debounce } from '../utils';
import { DiagnosticsManager, makeRunChecks } from '../diagnostics';
import { DocumentManager } from '../documents';
import { Dependencies } from '../types';
import { VERSION } from '../version';
import { DocumentLinksProvider } from '../documentLinks';
import { CodeActionKinds, CodeActionsProvider } from '../codeActions';
import { CompletionsProvider } from '../completions';
import { HoverProvider } from '../hover';
import { Commands, ExecuteCommandProvider } from '../commands';
import { ClientCapabilities } from '../ClientCapabilities';
import { GetTranslationsForURI, useBufferOrInjectedTranslations } from '../translations';
import { GetSnippetNamesForURI } from '../completions/providers/RenderSnippetCompletionProvider';
import { URI } from 'vscode-uri';

const defaultLogger = () => {};

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
    fileExists,
    fileSize,
    filesForURI,
    findRootURI: findConfigurationRootURI,
    getDefaultLocaleFactory,
    getDefaultTranslationsFactory,
    getThemeSettingsSchemaForRootURI,
    loadConfig,
    log = defaultLogger,
    schemaValidators: remoteSchemaValidators,
    themeDocset: remoteThemeDocset,
  }: Dependencies,
) {
  const clientCapabilities = new ClientCapabilities();
  const documentManager = new DocumentManager();
  const diagnosticsManager = new DiagnosticsManager(connection);
  const documentLinksProvider = new DocumentLinksProvider(documentManager);
  const codeActionsProvider = new CodeActionsProvider(documentManager, diagnosticsManager);

  const findThemeRootURI = async (uri: string) => {
    const rootUri = await findConfigurationRootURI(uri);
    const config = await loadConfig(rootUri);
    const root = URI.parse(rootUri).with({
      path: config.root,
    });
    return root.toString();
  };

  // These are augmented here so that the caching is maintained over different runs.
  const themeDocset = new AugmentedThemeDocset(remoteThemeDocset);
  const schemaValidators = new AugmentedSchemaValidators(remoteSchemaValidators);
  const runChecks = debounce(
    makeRunChecks(documentManager, diagnosticsManager, {
      fileExists,
      fileSize,
      findRootURI: findConfigurationRootURI,
      getDefaultLocaleFactory,
      getDefaultTranslationsFactory,
      loadConfig,
      themeDocset,
      schemaValidators,
    }),
    100,
  );

  const getTranslationsForURI: GetTranslationsForURI = async (uri) => {
    const rootURI = await findThemeRootURI(uri);
    const theme = documentManager.theme(rootURI);
    return useBufferOrInjectedTranslations(getDefaultTranslationsFactory, theme, rootURI);
  };

  const getSnippetNamesForURI: GetSnippetNamesForURI = async (uri: string) => {
    if (!filesForURI) return [];
    const files = await filesForURI(uri);
    return files
      .filter((x) => x.startsWith('snippets'))
      .map((x) =>
        x
          .replace(/\\/g, '/')
          .replace(/^snippets\//, '')
          .replace(/\..*$/, ''),
      );
  };

  const getThemeSettingsSchemaForURI = async (uri: string) => {
    const rootUri = await findThemeRootURI(uri);
    return getThemeSettingsSchemaForRootURI(rootUri);
  };

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
    clientCapabilities.setup(params.capabilities);

    const fileOperationRegistrationOptions: FileOperationRegistrationOptions = {
      filters: [
        {
          scheme: 'file',
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
          openClose: true,
        },
        codeActionProvider: {
          codeActionKinds: [...CodeActionKinds],
        },
        completionProvider: {
          triggerCharacters: ['.', '{{ ', '{% ', '<', '/', '[', '"', "'"],
        },
        documentLinkProvider: {
          resolveProvider: false,
          workDoneProgress: false,
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
  });

  connection.onDidOpenTextDocument((params) => {
    const { uri, text, version } = params.textDocument;
    documentManager.open(uri, text, version);
    runChecks([uri]);
  });

  connection.onDidChangeTextDocument((params) => {
    const { uri, version } = params.textDocument;
    documentManager.change(uri, params.contentChanges[0].text, version);
    runChecks([uri]);
  });

  connection.onDidCloseTextDocument((params) => {
    const { uri } = params.textDocument;
    documentManager.close(uri);
    diagnosticsManager.clear(uri);
  });

  connection.onDocumentLinks(async (params) => {
    const { uri } = params.textDocument;
    const rootUri = await findThemeRootURI(uri);
    return documentLinksProvider.documentLinks(uri, rootUri);
  });

  connection.onCodeAction(async (params) => {
    return codeActionsProvider.codeActions(params);
  });

  connection.onExecuteCommand(async (params) => {
    await executeCommandProvider.execute(params);
  });

  connection.onCompletion(async (params) => {
    return completionsProvider.completions(params);
  });

  connection.onHover(async (params) => {
    return hoverProvider.hover(params);
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
  connection.onNotification(DidCreateFilesNotification.type, (params) => {
    const triggerUris = params.files.map((fileCreate) => fileCreate.uri);
    runChecks.force(triggerUris);
  });
  connection.onNotification(DidRenameFilesNotification.type, (params) => {
    const triggerUris = params.files.map((fileRename) => fileRename.newUri);
    runChecks.force(triggerUris);
  });
  connection.onNotification(DidDeleteFilesNotification.type, (params) => {
    const triggerUris = params.files.map((fileDelete) => fileDelete.uri);
    runChecks.force(triggerUris);
  });

  connection.listen();
}
