import { FileStat, FileTuple, path as pathUtils } from '@shopify/theme-check-common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { commands, ExtensionContext, languages, Uri, workspace, window, env } from 'vscode';
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

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let client: LanguageClient | undefined;

export async function activate(context: ExtensionContext) {
  const runChecksCommand = 'themeCheck/runChecks';

  // Setup and start MCP server
  await setupMCPServer(context);

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
  await setupMCPServer(context);
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

// eslint-disable-next-line no-unused-vars
async function setupMCPServer(context: ExtensionContext) {
  try {
    await ensureMCPConfig();
  } catch (error) {
    console.error('Failed to setup MCP server:', error);
    window.showErrorMessage('Failed to setup MCP server. Check the console for details.');
  }
}

async function ensureMCPConfig() {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  const editor = detectEditor();

  if (!editor) {
    console.warn('Could not detect editor, skipping MCP config creation');
    return;
  }

  const mcpConfigPath = path.join(workspaceRoot, `.${editor}`, 'mcp.json');

  try {
    await fs.access(mcpConfigPath);
    console.log('MCP config already exists at:', mcpConfigPath);
  } catch (error) {
    // File doesn't exist, create it
    await createMCPConfig(mcpConfigPath);
  }
}

async function createMCPConfig(configPath: string) {
  const configDir = path.dirname(configPath);

  // Ensure the directory exists
  try {
    await fs.access(configDir);
  } catch (error) {
    await fs.mkdir(configDir, { recursive: true });
  }

  /*
  * The path ONLY works on local environments.
  * To be able to reference the MCP in production, we need to update the path to be a reference to a published
  * NPM package.
  */
  const mcpConfig = {
    [ detectEditor() === 'vscode' ? 'servers': 'mcpServers' ]: {
      themeComponentGenerator: {
        command: 'node',
        args: ["--experimental-strip-types", __dirname.match(/^.*?theme-tools\/packages/)?.[0] + "/theme-component-generator/src/index.ts"],
        env: {},
      },
    },
  };

  await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
  console.log('Created MCP config at:', configPath);
}

function detectEditor(): string | undefined {
  const appName = env.appName.toLowerCase();

  if (appName.includes('cursor')) {
    return 'cursor';
  }

  if (
    appName.includes('vscode') ||
    appName.includes('visual studio code')
  ) {
    return 'vscode';
  }

  return;
}

