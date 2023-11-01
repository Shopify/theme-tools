import { startServer as startCoreServer } from '@shopify/theme-language-server-common';
import { ThemeLiquidDocsManager } from '@shopify/theme-check-docs-updater';
import { stdin, stdout } from 'node:process';
import { createConnection } from 'vscode-languageserver/node';
import {
  fileExists,
  fileSize,
  filesForURI,
  findRootURI,
  getDefaultLocaleFactory,
  getDefaultTranslationsFactory,
  getThemeSettingsSchemaForRootURI,
  loadConfig,
} from './dependencies';

export function startServer() {
  const connection = createConnection(stdin, stdout);
  const log = (message: string) => console.error(message);
  const themeLiquidDocsManager = new ThemeLiquidDocsManager(log);

  startCoreServer(connection, {
    // Using console.error to not interfere with messages sent on STDIN/OUT
    log,
    getDefaultTranslationsFactory,
    getDefaultLocaleFactory,
    getThemeSettingsSchemaForRootURI,
    findRootURI,
    fileExists,
    fileSize,
    filesForURI,
    loadConfig,
    themeDocset: themeLiquidDocsManager,
    schemaValidators: themeLiquidDocsManager,
  });
}
