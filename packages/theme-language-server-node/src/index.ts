import { ThemeLiquidDocsManager } from '@shopify/theme-check-docs-updater';
import {
  AbstractFileSystem,
  CustomCheckAuthorizationRequest,
  NodeFileSystem,
} from '@shopify/theme-check-node';
import { startServer as startCoreServer } from '@shopify/theme-language-server-common';
import { stdin, stdout } from 'node:process';
import { createConnection } from 'vscode-languageserver/node';
import { loadConfig } from './dependencies';
import { fetchMetafieldDefinitionsForURI } from './metafieldDefinitions';

export { NodeFileSystem } from '@shopify/theme-check-node';
export * from '@shopify/theme-language-server-common';

export const getConnection = () => createConnection(stdin, stdout);

export interface StartServerOptions {
  authorizeCustomChecks?: (request: CustomCheckAuthorizationRequest) => Promise<boolean>;
}

export function startServer(
  connection = getConnection(),
  fs: AbstractFileSystem = NodeFileSystem,
  options: StartServerOptions = {},
) {
  // Using console.error to not interfere with messages sent on STDIN/OUT
  const log = (message: string) => console.error(message);
  const themeLiquidDocsManager = new ThemeLiquidDocsManager(log);

  startCoreServer(connection, {
    fs,
    log,
    loadConfig: (uri, fs) =>
      loadConfig(uri, fs, { authorizeCustomChecks: options.authorizeCustomChecks }),
    themeDocset: themeLiquidDocsManager,
    jsonValidationSet: themeLiquidDocsManager,
    fetchMetafieldDefinitionsForURI,
  });
}
