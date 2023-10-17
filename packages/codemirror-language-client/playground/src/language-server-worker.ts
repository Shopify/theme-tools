import {
  startServer,
  allChecks,
} from '@shopify/theme-language-server-browser';
import { isDependencyInjectionMessage } from './messages';

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
  getDefaultLocaleFactory: (_: string) => async () => 'en',
  themeDocset: {
    filters: async () => [],
    tags: async () => [],
    objects: async () => [],
  },
  schemaValidators: {
    validateSectionSchema: async () => () => true,
  },
  loadConfig,
  log(message) {
    console.info(message);
  },
});

export {};
