import { FileStat, FileTuple, path as pathUtils } from '@shopify/theme-check-common';
import * as path from 'node:path';
import {
  commands,
  ExtensionContext,
  languages,
  Position,
  Range,
  TextEditor,
  TextEditorDecorationType,
  Uri,
  workspace,
} from 'vscode';
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
import { getSidekickAnalysis, LiquidSuggestion, log, SidekickDecoration } from './sidekick';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let $client: LanguageClient | undefined;
let $editor: TextEditor | undefined;
let $decorations: TextEditorDecorationType[] = [];

export async function activate(context: ExtensionContext) {
  const runChecksCommand = 'themeCheck/runChecks';

  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.restart', () => restartServer(context)),
  );
  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.runChecks', () => {
      $client!.sendRequest('workspace/executeCommand', { command: runChecksCommand });
    }),
  );
  context.subscriptions.push(
    languages.registerDocumentFormattingEditProvider(
      [{ language: 'liquid' }],
      new LiquidFormatter(vscodePrettierFormat),
    ),
  );
  context.subscriptions.push(
    commands.registerTextEditorCommand('shopifyLiquid.sidekick', async (textEditor: TextEditor) => {
      $editor = textEditor;

      log('Sidekick is analyzing...');
      await Promise.all([
        commands.executeCommand('setContext', 'shopifyLiquid.sidekick.isLoading', true),
      ]);

      try {
        // Show sidekick decorations
        applyDecorations(await getSidekickAnalysis(textEditor));
      } finally {
        await Promise.all([
          commands.executeCommand('setContext', 'shopifyLiquid.sidekick.isLoading', false),
        ]);
      }
    }),
  );
  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.sidefix', async (suggestion: LiquidSuggestion) => {
      log('Sidekick is fixing...');

      applySuggestion(suggestion);
    }),
  );
  // context.subscriptions.push(
  //   languages.registerInlineCompletionItemProvider(
  //     [{ language: 'liquid' }],
  //     new LiquidCompletionProvider(),
  //   ),
  // );

  context.subscriptions.push(
    workspace.onDidChangeTextDocument(() => {
      disposeDecorations();
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

  $client = new LanguageClient(
    'shopifyLiquid',
    'Theme Check Language Server',
    serverOptions,
    clientOptions,
  );

  $client.onRequest('fs/readDirectory', async (uriString: string): Promise<FileTuple[]> => {
    const results = await workspace.fs.readDirectory(Uri.parse(uriString));
    return results.map(([name, type]) => [pathUtils.join(uriString, name), type]);
  });

  $client.onRequest('fs/readFile', async (uriString: string): Promise<string> => {
    const bytes = await workspace.fs.readFile(Uri.parse(uriString));
    return Buffer.from(bytes).toString('utf8');
  });

  $client.onRequest('fs/stat', async (uriString: string): Promise<FileStat> => {
    return workspace.fs.stat(Uri.parse(uriString));
  });

  $client.start();
}

async function stopServer() {
  try {
    if ($client) {
      await Promise.race([$client.stop(), sleep(1000)]);
    }
  } catch (e) {
    console.error(e);
  } finally {
    $client = undefined;
  }
}

async function restartServer(context: ExtensionContext) {
  if ($client) {
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

// TODO: Check if we need to manually dispose decorations, or if we may be able to rely on the language server to do it
function disposeDecorations() {
  $decorations.forEach((decoration) => decoration.dispose());
  $decorations = [];
}

function applyDecorations(decorations: SidekickDecoration[]) {
  disposeDecorations();

  decorations.forEach((decoration) => {
    $decorations.push(decoration.type);
    $editor?.setDecorations(decoration.type, [decoration.options]);
  });
}

function applySuggestion({ range, newCode }: LiquidSuggestion) {
  $editor?.edit((textEditorEdit) => {
    try {
      const start = new Position(range.start.line - 1, range.start.character);
      const end = range.end;

      textEditorEdit.replace(new Range(start, end), newCode);
    } catch (err) {
      log('Error during sidefix', err);
    }

    disposeDecorations();
  });
}
