/// <reference lib="webworker" />
import { FileStat, FileTuple, path } from '@shopify/theme-check-common';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  DocumentSelector,
} from 'vscode-languageclient/browser';
import LiquidFormatter from '../common/formatter';
import { vscodePrettierFormat } from './formatter';
import { documentSelectors } from '../common/constants';
import PREVIEW_HTML from './preview.html';

declare global {
  export const PREVIEW_HTML: string;
}
const { commands, languages, Uri, workspace } = vscode;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const runChecksCommand = 'themeCheck/runChecks';

  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.restart', () => restartServer(context)),
  );

  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.runChecks', () => {
      client!.sendRequest('workspace/executeCommand', { command: runChecksCommand });
    }),
  );

  context.subscriptions.push(
    languages.registerDocumentFormattingEditProvider(
      [{ language: 'liquid' }],
      new LiquidFormatter(vscodePrettierFormat),
    ),
  );

  await startServer(context);
}

export function deactivate() {
  return stopServer();
}

async function startServer(context: vscode.ExtensionContext) {
  console.log('Starting Theme Check Language Server');
  const clientOptions: LanguageClientOptions = {
    documentSelector: documentSelectors as DocumentSelector,
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

  const panels: vscode.WebviewPanel[] = [];

  context.subscriptions.push(
    commands.registerCommand('catCoding.start', async () => {
      // Create and show panel
      const panel = vscode.window.createWebviewPanel(
        'catCoding',
        'Cat Coding',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
        },
      );

      // And set its HTML content
      panel.webview.html = await getWebviewContent();
      // panels.push(panel);

      panel.onDidDispose(() => {
        disposeFS.dispose();
      });

      const disposeFS = workspace
        .createFileSystemWatcher('**/*.{liquid,html}')
        .onDidChange(async (uri) => {
          console.info('this file changed', uri);
          try {
            const contents = await workspace.fs.readFile(uri);
            panel.webview.postMessage({
              type: 'change',
              path: uri.path,
              data: textDecoder.decode(contents),
            });
          } catch (e) {
            console.error(e);
          }
        });
    }),
  );

  client.start();
  console.log('Theme Check Language Server started');
}

async function getWebviewContent() {
  return PREVIEW_HTML;
}

function createWorkerLanguageClient(
  context: vscode.ExtensionContext,
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

async function restartServer(context: vscode.ExtensionContext) {
  if (client) {
    await stopServer();
  }
  await startServer(context);
}
