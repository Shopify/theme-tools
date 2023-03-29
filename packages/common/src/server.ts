import {
  Connection,
  InitializeResult,
  TextDocumentSyncKind,
} from 'vscode-languageserver';
import { debounce } from './utils';
import { DiagnosticsManager } from './diagnostics';
import { DocumentManager } from './documents';
import { Dependencies } from './types';
import { makeRunChecks } from './diagnostics/runChecks';

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
    log = defaultLogger,
    loadConfig,
    findRootURI,
    getDefaultTranslationsFactory,
    fileExists,
  }: Dependencies,
) {
  let documentManager: DocumentManager;
  const diagnosticsManager = new DiagnosticsManager(connection);
  const runChecks = debounce(
    makeRunChecks({
      loadConfig,
      findRootURI,
      getDefaultTranslationsFactory,
      fileExists,
    }),
    100,
  );

  connection.onInitialize((_params) => {
    documentManager = new DocumentManager();

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: {
          change: TextDocumentSyncKind.Full,
        },
      },
      serverInfo: {
        name: 'liquid-language-server',
        version: '0.0.1',
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
    runChecks(documentManager, diagnosticsManager, uri);
  });

  connection.onDidChangeTextDocument((params) => {
    const { uri, version } = params.textDocument;
    documentManager.change(uri, params.contentChanges[0].text, version);
    runChecks(documentManager, diagnosticsManager, uri);
  });

  connection.onDidCloseTextDocument((params) => {
    const { uri } = params.textDocument;
    documentManager.close(uri);
    diagnosticsManager.clear(uri);
  });

  connection.listen();
}
