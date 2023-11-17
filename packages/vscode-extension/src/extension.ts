import * as path from 'node:path';
import { commands, DocumentFilter, ExtensionContext, languages, Uri, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import LiquidFormatter from './formatter';
import { getLegacyModeServerOptions } from './legacyMode';
import { getConfig } from './utils';

const LIQUID: DocumentFilter[] = [
  {
    language: 'liquid',
    scheme: 'file',
  },
  {
    language: 'liquid',
    scheme: 'untitled',
  },
];

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext) {
  const isRubyLanguageServer = getConfig('shopifyLiquid.legacyMode');
  const runChecksCommand = isRubyLanguageServer ? 'runChecks' : 'themeCheck/runChecks';

  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.restart', () => restartServer(context)),
  );
  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.runChecks', () => {
      client!.sendRequest('workspace/executeCommand', { command: runChecksCommand });
    }),
  );

  const diagnosticTextDocumentVersion = new Map<Uri, number>();
  const diagnosticCollection = languages.createDiagnosticCollection('prettier-plugin-liquid');
  if (isRubyLanguageServer) {
    // The TS version doesn't need this, we have LiquidHTMLSyntaxError for that.
    context.subscriptions.push(diagnosticCollection);
  }

  // TODO move this to language server (?) Might have issues with prettier import
  const formattingProvider = languages.registerDocumentFormattingEditProvider(
    LIQUID,
    new LiquidFormatter(diagnosticCollection, diagnosticTextDocumentVersion),
  );
  context.subscriptions.push(formattingProvider);

  workspace.onDidChangeConfiguration(onConfigChange(context));

  // If you change the file, the prettier syntax error is no longer valid
  workspace.onDidChangeTextDocument(({ document }) => {
    const bufferVersionOfDiagnostic = diagnosticTextDocumentVersion.get(document.uri);
    if (bufferVersionOfDiagnostic !== document.version) {
      diagnosticCollection.delete(document.uri);
    }
  });

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
    documentSelector: [
      { scheme: 'file', language: 'liquid' },
      { scheme: 'file', language: 'plaintext' },
      { scheme: 'file', language: 'html' },
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'css' },
      { scheme: 'file', language: 'scss' },
      { scheme: 'file', language: 'json' },
    ],
  };

  client = new LanguageClient(
    'shopifyLiquid',
    'Theme Check Language Server',
    serverOptions,
    clientOptions,
  );

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

const onConfigChange =
  (context: ExtensionContext) => (event: { affectsConfiguration: (arg0: string) => any }) => {
    const didChangeThemeCheck = event.affectsConfiguration('shopifyLiquid.languageServerPath');
    const didChangeShopifyCLI = event.affectsConfiguration('shopifyLiquid.shopifyCLIPath');
    const didChangeLegacyMode = event.affectsConfiguration('shopifyLiquid.legacyMode');
    if (didChangeThemeCheck || didChangeShopifyCLI || didChangeLegacyMode) {
      restartServer(context);
    }
  };

async function getServerOptions(context: ExtensionContext): Promise<ServerOptions | undefined> {
  if (getConfig('shopifyLiquid.legacyMode')) {
    return getLegacyModeServerOptions();
  }

  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));
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
