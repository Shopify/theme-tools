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
  window,
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

async function isShopifyTheme(workspaceRoot: string): Promise<boolean> {
  try {
    // Check for typical Shopify theme folders
    const requiredFolders = ['sections', 'templates', 'assets', 'config'];
    for (const folder of requiredFolders) {
      const folderUri = Uri.file(path.join(workspaceRoot, folder));
      try {
        await workspace.fs.stat(folderUri);
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function isCursor(): boolean {
  // Check if we're running in Cursor's electron process
  const processTitle = process.title.toLowerCase();
  const isElectronCursor =
    processTitle.includes('cursor') && process.versions.electron !== undefined;

  // Check for Cursor-specific environment variables that are set by Cursor itself
  const hasCursorEnv =
    process.env.CURSOR_CHANNEL !== undefined || process.env.CURSOR_VERSION !== undefined;

  return isElectronCursor || hasCursorEnv;
}

interface ConfigFile {
  path: string;
  templateName: string;
  prompt: string;
}

async function getConfigFileDetails(workspaceRoot: string): Promise<ConfigFile> {
  if (isCursor()) {
    return {
      path: path.join(workspaceRoot, '.cursorrules'),
      templateName: 'llm_instructions.template',
      prompt:
        'Detected Shopify theme project in Cursor. Do you want a .cursorrules file to be created?',
    };
  }
  return {
    path: path.join(workspaceRoot, '.github', 'copilot-instructions.md'),
    templateName: 'llm_instructions.template',
    prompt:
      'Detected Shopify theme project in VSCode. Do you want a Copilot instructions file to be created?',
  };
}

export async function activate(context: ExtensionContext) {
  const runChecksCommand = 'themeCheck/runChecks';

  if (workspace.workspaceFolders?.length) {
    const workspaceRoot = workspace.workspaceFolders[0].uri.fsPath;
    const instructionsConfig = await getConfigFileDetails(workspaceRoot);

    // Don't do anything if the file already exists
    try {
      await workspace.fs.stat(Uri.file(instructionsConfig.path));
      return;
    } catch {
      // File doesn't exist, continue
    }

    if (await isShopifyTheme(workspaceRoot)) {
      const response = await window.showInformationMessage(instructionsConfig.prompt, 'Yes', 'No');

      if (response === 'Yes') {
        // Create directory if it doesn't exist (needed for .github case)
        const dir = path.dirname(instructionsConfig.path);
        try {
          await workspace.fs.createDirectory(Uri.file(dir));
        } catch {
          // Directory might already exist, continue
        }

        // Read the template file from the extension's resources
        const templateContent = await workspace.fs.readFile(
          Uri.file(context.asAbsolutePath(`resources/${instructionsConfig.templateName}`)),
        );
        await workspace.fs.writeFile(Uri.file(instructionsConfig.path), templateContent);
        console.log(`Wrote instructions file to ${instructionsConfig.path}`);
      }
    }
  }

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

      textEditorEdit.replace(new Range(start, end), newCode + '\n');
    } catch (err) {
      log('Error during sidefix', err);
    }

    disposeDecorations();
  });
}
