import { AugmentedJsonValidationSet, AugmentedThemeDocset } from '@shopify/theme-check-common';
import {
  Connection,
  FileOperationRegistrationOptions,
  InitializeResult,
  TextDocumentSyncKind,
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { ClientCapabilities } from '../ClientCapabilities';
import { CodeActionKinds, CodeActionsProvider } from '../codeActions';
import { Commands, ExecuteCommandProvider } from '../commands';
import { CompletionsProvider } from '../completions';
import { GetSnippetNamesForURI } from '../completions/providers/RenderSnippetCompletionProvider';
import { DiagnosticsManager, makeRunChecks } from '../diagnostics';
import { DocumentLinksProvider } from '../documentLinks';
import { DocumentManager } from '../documents';
import { OnTypeFormattingProvider } from '../formatting';
import { HoverProvider } from '../hover';
import { JSONLanguageService } from '../json/JSONLanguageService';
import { GetTranslationsForURI, useBufferOrInjectedTranslations } from '../translations';
import { Dependencies } from '../types';
import { debounce } from '../utils';
import { VERSION } from '../version';
import { Configuration } from './Configuration';

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
    jsonValidationSet: remoteSchemaValidators,
    themeDocset: remoteThemeDocset,
  }: Dependencies,
) {
  const clientCapabilities = new ClientCapabilities();
  const configuration = new Configuration(connection, clientCapabilities);
  const documentManager = new DocumentManager();
  const diagnosticsManager = new DiagnosticsManager(connection);
  const documentLinksProvider = new DocumentLinksProvider(documentManager);
  const codeActionsProvider = new CodeActionsProvider(documentManager, diagnosticsManager);
  const onTypeFormattingProvider = new OnTypeFormattingProvider(documentManager);

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
  const jsonValidationSet = new AugmentedJsonValidationSet(remoteSchemaValidators);
  const runChecks = debounce(
    makeRunChecks(documentManager, diagnosticsManager, {
      fileExists,
      fileSize,
      findRootURI: findConfigurationRootURI,
      getDefaultLocaleFactory,
      getDefaultTranslationsFactory,
      loadConfig,
      themeDocset,
      jsonValidationSet,
    }),
    100,
  );

  const getTranslationsForURI: GetTranslationsForURI = async (uri) => {
    const rootURI = await findThemeRootURI(uri);
    const theme = documentManager.theme(rootURI);

    const getTranslationsFactory = (rootUri: string) => {
      return async () => {
        const [defaultTranslations, shopifyTranslations] = await Promise.all([
          getDefaultTranslationsFactory(rootUri)(),
          themeDocset.systemTranslations(),
        ]);

        return { ...defaultTranslations, ...shopifyTranslations };
      };
    };

    return useBufferOrInjectedTranslations(getTranslationsFactory, theme, rootURI);
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

  const jsonLanguageService = new JSONLanguageService(documentManager, jsonValidationSet);
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
          save: true,
          openClose: true,
        },
        codeActionProvider: {
          codeActionKinds: [...CodeActionKinds],
        },
        completionProvider: {
          triggerCharacters: ['.', '{{ ', '{% ', '<', '/', '[', '"', "'"],
        },
        documentOnTypeFormattingProvider: {
          firstTriggerCharacter: ' ',
          moreTriggerCharacter: ['{', '%', '-'],
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
    configuration.fetchConfiguration();
    configuration.registerDidChangeCapability();
  });

  connection.onDidChangeConfiguration((_params) => {
    configuration.clearCache();
  });

  connection.onDidOpenTextDocument(async (params) => {
    const { uri, text, version } = params.textDocument;
    documentManager.open(uri, text, version);
    if (await configuration.shouldCheckOnOpen()) {
      runChecks([uri]);
    }
  });

  connection.onDidChangeTextDocument(async (params) => {
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
    const { uri } = params.textDocument;
    if (await configuration.shouldCheckOnSave()) {
      runChecks([uri]);
    }
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
    return (
      (await jsonLanguageService.completions(params)) ??
      (await completionsProvider.completions(params))
    );
  });

  connection.onHover(async (params) => {
    return (await jsonLanguageService.hover(params)) ?? (await hoverProvider.hover(params));
  });

  connection.onDocumentOnTypeFormatting(async (params) => {
    return onTypeFormattingProvider.onTypeFormatting(params);
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
  });
  connection.workspace.onDidRenameFiles((params) => {
    const triggerUris = params.files.map((fileRename) => fileRename.newUri);
    runChecks.force(triggerUris);
  });
  connection.workspace.onDidDeleteFiles((params) => {
    const triggerUris = params.files.map((fileDelete) => fileDelete.uri);
    runChecks.force(triggerUris);
  });

  connection.listen();
}
