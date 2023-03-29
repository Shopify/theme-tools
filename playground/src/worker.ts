import { allChecks } from '@shopify/theme-check-common';
import { startServer } from '@shopify/liquid-language-server-browser';
import { URI } from 'vscode-languageserver-types';

async function fileExists(_uri: URI) {
  // :D
  return true;
}

async function findRootURI(_uri: URI) {
  return 'browser:///';
}

async function loadConfig(_uri: URI) {
  return {
    settings: {},
    checks: allChecks,
    root: '/',
  };
}

function getDefaultTranslationsFactory() {
  const defaultTranslations: object = {
    product: {
      price: 'Price',
      size: 'Size',
    },
  };
  return async () => defaultTranslations;
}

startServer(self as any as Worker, {
  fileExists,
  findRootURI,
  getDefaultTranslationsFactory,
  loadConfig,
});
