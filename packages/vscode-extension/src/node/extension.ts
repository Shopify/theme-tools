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
  WorkspaceEdit,
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

type LiquidSuggestionWithDecorationKey = LiquidSuggestion & { key: string };

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let $client: LanguageClient | undefined;
let $editor: TextEditor | undefined;
let $decorations: TextEditorDecorationType[] = [];
let $isApplyingSuggestion = false;
let $previousShownConflicts = new Map<string, number>();

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
      templateName: 'llm-instructions.template',
      prompt:
        'Detected Shopify theme project in Cursor. Do you want a .cursorrules file to be created?',
    };
  }
  return {
    path: path.join(workspaceRoot, '.github', 'copilot-instructions.md'),
    templateName: 'llm-instructions.template',
    prompt:
      'Detected Shopify theme project in VSCode. Do you want a Copilot instructions file to be created?',
  };
}

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
      templateName: 'llm-instructions.template',
      prompt:
        'Detected Shopify theme project in Cursor. Do you want a .cursorrules file to be created?',
    };
  }
  return {
    path: path.join(workspaceRoot, '.github', 'copilot-instructions.md'),
    templateName: 'llm-instructions.template',
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
    commands.registerCommand(
      'shopifyLiquid.sidefix',
      async (suggestion: LiquidSuggestionWithDecorationKey) => {
        log('Sidekick is fixing...');

        applySuggestion(suggestion);
      },
    ),
  );
  // context.subscriptions.push(
  //   languages.registerInlineCompletionItemProvider(
  //     [{ language: 'liquid' }],
  //     new LiquidCompletionProvider(),
  //   ),
  // );

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

const conflictMarkerStart = '<<<<<<< Current';
const conflictMarkerMiddle = '=======';
const conflictMarkerEnd = '>>>>>>> Suggested Change';

async function applySuggestion({ key, range, newCode }: LiquidSuggestionWithDecorationKey) {
  log('Applying suggestion...');
  if (!$editor) {
    return;
  }

  $isApplyingSuggestion = true;

  const endLineIndex = range.end.line - 1;
  const start = new Position(range.start.line - 1, 0);
  const end = new Position(endLineIndex, $editor.document.lineAt(endLineIndex).text.length);
  const oldCode = $editor.document.getText(new Range(start, end));
  const initialIndentation = oldCode.match(/^[ \t]+/)?.[0] ?? '';

  // Create a merge conflict style text
  const conflictText = [
    conflictMarkerStart,
    oldCode,
    conflictMarkerMiddle,
    newCode.replace(/^/gm, initialIndentation),
    conflictMarkerEnd,
  ].join('\n');

  // Replace the current text with the conflict markers
  const edit = new WorkspaceEdit();
  edit.replace($editor.document.uri, new Range(start, end), conflictText);
  await workspace.applyEdit(edit);

  // Only dispose the decoration associated with this suggestion
  const decorationIndex = $decorations.findIndex((d) => d.key === key);
  if (decorationIndex !== -1) {
    $decorations[decorationIndex].dispose();
    $decorations.splice(decorationIndex, 1);
  }

  $isApplyingSuggestion = false;
}
