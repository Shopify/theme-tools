import { FileStat, FileTuple, path as pathUtils } from '@shopify/theme-check-common';
import * as path from 'node:path';
import {
  commands,
  ExtensionContext,
  languages,
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
import { getShopifyMagicAnalysis, ShopifyMagicDecoration } from './shopify-magic';
import { showShopifyMagicButton, showShopifyMagicLoadingButton } from './ui';
import { createInstructionsFiles } from './llm-instructions';
import { RefactorProvider } from './RefactorProvider';
import { applySuggestion, conflictMarkerStart } from './shopify-magic-suggestions';

let $client: LanguageClient | undefined;
let $editor: TextEditor | undefined;
let $decorations: TextEditorDecorationType[] = [];
let $isApplyingSuggestion = false;
let $previousShownConflicts = new Map<string, number>();

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const log = (msg: string, ...opts: any[]) => console.error(`[Shopify Magic] ${msg}`, ...opts);

export async function activate(context: ExtensionContext) {
  const runChecksCommand = 'themeCheck/runChecks';

  await showShopifyMagicButton();
  await createInstructionsFiles(context);

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
    commands.registerTextEditorCommand(
      'shopifyLiquid.shopifyMagic',
      async (textEditor: TextEditor) => {
        $editor = textEditor;

        log('Shopify Magic is analyzing...');

        try {
          await showShopifyMagicLoadingButton();
          const decorations = await getShopifyMagicAnalysis(textEditor);
          applyDecorations(decorations);
        } finally {
          await showShopifyMagicButton();
        }
      },
    ),
  );

  context.subscriptions.push(
    commands.registerCommand('shopifyLiquid.sidefix', async (suggestion: any) => {
      log('Shopify Magic is fixing...');

      $isApplyingSuggestion = true;
      applySuggestion($editor, suggestion);

      // Only dispose the decoration associated with this suggestion
      const decorationIndex = $decorations.findIndex((d) => d.key === suggestion.key);
      if (decorationIndex !== -1) {
        $decorations[decorationIndex].dispose();
        $decorations.splice(decorationIndex, 1);
      }

      $isApplyingSuggestion = false;
    }),
  );

  context.subscriptions.push(
    languages.registerCodeActionsProvider([{ language: 'liquid' }], new RefactorProvider(), {
      providedCodeActionKinds: RefactorProvider.providedCodeActionKinds,
    }),
  );

  context.subscriptions.push(
    workspace.onDidChangeTextDocument(({ contentChanges, reason, document }) => {
      // Each shown suggestion fix is displayed as a conflict in the editor. We want to
      // hide all suggestion hints when the user starts typing, as they are no longer
      // relevant, but we don't want to remove them on conflict resolution since that
      // only means the user has accepted/rejected a suggestion and might continue with
      // the other suggestions.
      const currentShownConflicts = document.getText().split(conflictMarkerStart).length - 1;

      if (
        // Ignore when there are no content changes
        contentChanges.length > 0 &&
        // Ignore when initiating the diff view (it triggers a change event)
        !$isApplyingSuggestion &&
        // Ignore undo/redos
        reason === undefined &&
        // Only dispose decorations when there are no conflicts currently shown (no diff views)
        // and when there were no conflicts shown previously. This means that the current
        // change is not related to a conflict resolution but a manual user input.
        currentShownConflicts === 0 &&
        !$previousShownConflicts.get(document.fileName)
      ) {
        disposeDecorations();
      }

      // Store the previous number of conflicts shown for this document.
      $previousShownConflicts.set(document.fileName, currentShownConflicts);
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

function disposeDecorations() {
  $decorations.forEach((decoration) => decoration.dispose());
  $decorations = [];
}

function applyDecorations(decorations: ShopifyMagicDecoration[]) {
  disposeDecorations();

  decorations.forEach((decoration) => {
    $decorations.push(decoration.type);
    $editor?.setDecorations(decoration.type, [decoration.options]);
  });
}
