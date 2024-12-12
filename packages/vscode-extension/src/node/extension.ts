import { FileStat, FileTuple, path as pathUtils } from '@shopify/theme-check-common';
import * as path from 'node:path';
import { commands, ExtensionContext, languages, Uri, workspace, window } from 'vscode';
import {
  DocumentSelector,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { documentSelectors } from '../common/constants';
import LiquidFormatter from '../common/formatter';
import { vscodePrettierFormat } from './formatter';
import { LiquidProfiler } from './liquid_profiler';
import Config from 'conf';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let client: LanguageClient | undefined;
let liquidProfiler: LiquidProfiler | undefined;

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
  context.subscriptions.push(
    languages.registerDocumentFormattingEditProvider(
      [{ language: 'liquid' }],
      new LiquidFormatter(vscodePrettierFormat),
    ),
  );
  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.openPreview', async () => {
      const config = new Config({ projectName: 'shopify-cli-theme-conf' });
      const storeUrl = config.get('themeStore');

      if (!storeUrl) {
        window.showErrorMessage(
          'Make sure Shopify is CLI is available in your environment and authenticated',
        );
        return;
      }

      const url = await window.showInputBox({
        prompt: `Enter the URL path to profile on ${storeUrl}:\n`,
        placeHolder: '/products/classic-tee',
      });

      if (url) {
        // Instantiate the LiquidProfiler if it doesn't exist, and show the panel
        if (!liquidProfiler) {
          liquidProfiler = new LiquidProfiler(context);
        }
        try {
          await liquidProfiler.showProfileForUrl(url);
        } catch (error) {
          window.showErrorMessage(
            'Could not establish a profile for this URL. Check that you can execute `shopify theme profile` in your terminal',
          );
        }
      }
    }),
  );

  await startServer(context);
}

export function deactivate() {
  return stopServer();
}

async function startServer(context: ExtensionContext) {
  const serverOptions = await getServerOptions(context);
  console.info(
    'shopify.theme-check-vscode Server options %s',
    JSON.stringify(serverOptions, null, 2),
  );
  if (!serverOptions) {
    return;
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: documentSelectors as DocumentSelector,
  };

  client = new LanguageClient(
    'shopifyLiquid',
    'Theme Check Language Server',
    serverOptions,
    clientOptions,
  );

  client.onRequest('fs/readDirectory', async (uriString: string): Promise<FileTuple[]> => {
    const results = await workspace.fs.readDirectory(Uri.parse(uriString));
    return results.map(([name, type]) => [pathUtils.join(uriString, name), type]);
  });

  client.onRequest('fs/readFile', async (uriString: string): Promise<string> => {
    const bytes = await workspace.fs.readFile(Uri.parse(uriString));
    return Buffer.from(bytes).toString('utf8');
  });

  client.onRequest('fs/stat', async (uriString: string): Promise<FileStat> => {
    return workspace.fs.stat(Uri.parse(uriString));
  });

  client.start();
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

async function getServerOptions(context: ExtensionContext): Promise<ServerOptions | undefined> {
  const serverModule = context.asAbsolutePath(path.join('dist', 'node', 'server.js'));
  return {
    run: {
      module: serverModule,
      transport: TransportKind.stdio,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: {
        // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  };
}
