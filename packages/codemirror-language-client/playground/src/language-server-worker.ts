import { startServer, allChecks } from '@shopify/theme-language-server-browser';
import { isDependencyInjectionMessage } from './messages';
import { URI } from 'vscode-languageserver-types';

/**
 * These are replaced at build time by the contents of
 * @shopify/theme-check-docs-updater's DocsManager
 */
declare global {
  export const WEBPACK_TAGS: any[];
  export const WEBPACK_FILTERS: any[];
  export const WEBPACK_OBJECTS: any[];
  export const WEBPACK_SYSTEM_TRANSLATIONS: any;
}

const tags = WEBPACK_TAGS;
const filters = WEBPACK_FILTERS;
const objects = WEBPACK_OBJECTS;
const systemTranslations = WEBPACK_SYSTEM_TRANSLATIONS;

const worker = self as any as Worker;

// The file tree is provided from the main thread as an array of strings.
// The default translations are provided from the main thread.
let files: Set<string>;
let defaultTranslations: any = {};
worker.addEventListener('message', (ev) => {
  const message = ev.data;
  if (!isDependencyInjectionMessage(message)) return;

  switch (message.method) {
    case 'shopify/setDefaultTranslations': {
      return (defaultTranslations = message.params);
    }
    case 'shopify/setFileTree': {
      return (files = new Set(message.params));
    }
  }
});

async function fileExists(path: string) {
  return files && files.has(path);
}

function getDefaultTranslationsFactory(_uri: string) {
  return async () => defaultTranslations as any;
}

function getThemeSettingsSchemaForRootURI(_rootURI: URI) {
  return {} as any;
}

async function findRootURI(_uri: string) {
  return 'browser:///';
}

async function loadConfig(_uri: string) {
  return {
    settings: {},
    checks: allChecks,
    root: '/',
  };
}

startServer(worker, {
  fileSize: async (_: string) => 42,
  fileExists,
  findRootURI,
  getDefaultTranslationsFactory,
  getThemeSettingsSchemaForRootURI,
  getDefaultLocaleFactory: (_: string) => async () => 'en',
  themeDocset: {
    filters: async () => filters,
    tags: async () => tags,
    objects: async () => objects,
    systemTranslations: async () => systemTranslations,
  },
  jsonValidationSet: {
    validateSectionSchema: async () => () => true,
    sectionSchema: async () => '{}',
    translationSchema: async () => '{}',
  },
  loadConfig,
  log(message) {
    console.info(message);
  },
});

export {};
