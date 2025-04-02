import { findRoot, makeFileExists } from '@shopify/theme-check-common';
import {
  Dependencies,
  getConnection,
  recommendedChecks,
  startServer,
} from '@shopify/theme-language-server-browser';
import { VsCodeFileSystem } from '../common/VsCodeFileSystem';

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
const connection = getConnection(worker);
const fileSystem = new VsCodeFileSystem(connection, {});
const dependencies: Dependencies = {
  fs: fileSystem,
  log: console.info.bind(console),
  loadConfig: async (uri, fs) => {
    const fileExists = makeFileExists(fs);
    const rootUri = await findRoot(uri, fileExists);
    return {
      context: 'theme',
      settings: {},
      checks: recommendedChecks,
      rootUri,
    };
  },
  themeDocset: {
    filters: async () => filters,
    objects: async () => objects,
    liquidDrops: async () => objects,
    tags: async () => tags,
    systemTranslations: async () => systemTranslations,
  },
  jsonValidationSet: {
    schemas: async () => schemas,
  },
};

startServer(worker, dependencies, connection);
