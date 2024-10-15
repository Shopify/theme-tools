import { startServer as startCoreServer } from '@shopify/theme-language-server-common';
import { FileSystem, NodeFileSystem } from '@shopify/theme-check-node';
import { ThemeLiquidDocsManager } from '@shopify/theme-check-docs-updater';
import { stdin, stdout } from 'node:process';
import { createConnection } from 'vscode-languageserver/node';
import {
  filesForURI,
  findRootURI,
  getDefaultTranslationsFactory,
  getDefaultSchemaTranslationsFactory,
  getThemeSettingsSchemaForRootURI,
  loadConfig,
} from './dependencies';

export function startServer(fs: FileSystem = NodeFileSystem) {
  const connection = createConnection(stdin, stdout);
  const log = (message: string) => console.error(message);
  const themeLiquidDocsManager = new ThemeLiquidDocsManager(log);

  startCoreServer(connection, {
    // Using console.error to not interfere with messages sent on STDIN/OUT
    fs,
    log,
    getDefaultTranslationsFactory,
    getDefaultSchemaTranslationsFactory,
    getThemeSettingsSchemaForRootURI,
    findRootURI,
    filesForURI,
    loadConfig,
    themeDocset: themeLiquidDocsManager,
    jsonValidationSet: themeLiquidDocsManager,
  });
}
