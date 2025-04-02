import {
  Dependencies,
  allChecks,
  getConnection,
  startServer,
  AbstractFileSystem,
  FileTuple,
  FileStat,
} from '@shopify/theme-language-server-browser';
import { Connection } from 'vscode-languageserver';

/**
 * These are replaced at build time by the contents of
 * @shopify/theme-check-docs-updater's DocsManager
 */
declare global {
  export const WEBPACK_TAGS: any[];
  export const WEBPACK_FILTERS: any[];
  export const WEBPACK_OBJECTS: any[];
  export const WEBPACK_SYSTEM_TRANSLATIONS: any;
  export const WEBPACK_SCHEMAS: any;
}

const tags = WEBPACK_TAGS;
const filters = WEBPACK_FILTERS;
const objects = WEBPACK_OBJECTS;
const systemTranslations = WEBPACK_SYSTEM_TRANSLATIONS;
const schemas = WEBPACK_SCHEMAS;

const worker = self as any as Worker;

const loadConfig: Dependencies['loadConfig'] = async (_uri, fileExists) => ({
  context: 'theme',
  settings: {},
  checks: allChecks,
  rootUri: 'browser:/',
});

const connection = getConnection(worker);

class MainThreadFileSystem implements AbstractFileSystem {
  constructor(private connection: Connection) {
    this.connection = connection;
  }

  async readFile(uri: string) {
    return this.connection.sendRequest('fs/readFile', uri) as Promise<string>;
  }

  async readDirectory(uri: string) {
    return this.connection.sendRequest('fs/readDirectory', uri) as Promise<FileTuple[]>;
  }

  async stat(uri: string) {
    return this.connection.sendRequest('fs/stat', uri) as Promise<FileStat>;
  }
}

startServer(
  worker,
  {
    fs: new MainThreadFileSystem(connection),
    themeDocset: {
      filters: async () => filters,
      tags: async () => tags,
      objects: async () => objects,
      liquidDrops: async () => objects,
      systemTranslations: async () => systemTranslations,
    },
    jsonValidationSet: {
      schemas: async () => schemas,
    },
    loadConfig,
    log(message) {
      console.info(message);
    },
  },
  connection,
);

export {};
