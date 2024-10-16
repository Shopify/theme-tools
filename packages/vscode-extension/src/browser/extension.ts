/// <reference lib="webworker" />
import { FileStat, FileTuple, path } from '@shopify/theme-check-common';
import { commands, ExtensionContext, Uri, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient/browser';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext) {
  const runChecksCommand = 'themeCheck/runChecks';

  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.restart', () => restartServer(context)),
  );

  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.runChecks', () => {
      client!.sendRequest('workspace/executeCommand', { command: runChecksCommand });
    }),
  );

  // const diagnosticTextDocumentVersion = new Map<Uri, number>();
  // const diagnosticCollection = languages.createDiagnosticCollection('prettier-plugin-liquid');
  // if (isRubyLanguageServer) {
  //   // The TS version doesn't need this, we have LiquidHTMLSyntaxError for that.
  //   context.subscriptions.push(diagnosticCollection);
  // }

  // TODO move this to language server (?) Might have issues with prettier import
  // const formattingProvider = languages.registerDocumentFormattingEditProvider(
  //   LIQUID,
  //   new LiquidFormatter(diagnosticCollection, diagnosticTextDocumentVersion),
  // );
  // context.subscriptions.push(formattingProvider);

  // // If you change the file, the prettier syntax error is no longer valid
  // workspace.onDidChangeTextDocument(({ document }) => {
  //   const bufferVersionOfDiagnostic = diagnosticTextDocumentVersion.get(document.uri);
  //   if (bufferVersionOfDiagnostic !== document.version) {
  //     diagnosticCollection.delete(document.uri);
  //   }
  // });

  await startServer(context);
}

export function deactivate() {
  return stopServer();
}

async function startServer(context: ExtensionContext) {
  console.log('Starting Theme Check Language Server');
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: 'liquid' },
      { language: 'plaintext' },
      { language: 'html' },
      { language: 'javascript' },
      { language: 'css' },
      { language: 'scss' },
      { language: 'json' },
      { language: 'jsonc' },
    ],
  };

  client = createWorkerLanguageClient(context, clientOptions);

  client.onRequest('fs/readDirectory', async (uriString: string): Promise<FileTuple[]> => {
    const results = await workspace.fs.readDirectory(Uri.parse(uriString));
    return results.map(([name, type]) => [path.join(uriString, name), type]);
  });

  const textDecoder = new TextDecoder();
  client.onRequest('fs/readFile', async (uriString: string): Promise<string> => {
    const bytes = await workspace.fs.readFile(Uri.parse(uriString));
    return textDecoder.decode(bytes);
  });

  client.onRequest('fs/stat', async (uriString: string): Promise<FileStat> => {
    return workspace.fs.stat(Uri.parse(uriString));
  });

  client.start();
  console.log('Theme Check Language Server started');
}

function createWorkerLanguageClient(
  context: ExtensionContext,
  clientOptions: LanguageClientOptions,
) {
  // Create a worker. The worker main file implements the language server.
  const serverMain = Uri.joinPath(context.extensionUri, 'dist', 'browser', 'server.js');
  const worker = new Worker(serverMain.toString(true));

  // create the language server client to communicate with the server running in the worker
  return new LanguageClient('shopifyLiquid', 'Theme Check Language Server', clientOptions, worker);
}

async function stopServer() {
  try {
    if (client) {
      await Promise.race([client.stop(), sleep(1000)]);
    }
  } catch (e) {
    console.error(e);
  } finally {
    client = undefined;
  }
}

async function restartServer(context: ExtensionContext) {
  if (client) {
    await stopServer();
  }
  await startServer(context);
}
