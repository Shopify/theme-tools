import { allChecks, Translations } from '@shopify/theme-check-common';
import { startServer } from '@shopify/liquid-language-server-browser';
import { URI } from 'vscode-languageserver-types';
import {
  isSetDefaultTranslationsNotification,
  isSetFileTreeNotificationMessage,
} from './types';

const worker = self as any as Worker;

// The file tree is provided from the main thread as an array of strings.
let files: Set<string>;
worker.addEventListener('message', (ev) => {
  const message = ev.data;
  if (isSetFileTreeNotificationMessage(message)) {
    files = new Set(message.params);
  }
});

async function fileExists(path: string) {
  return files.has(path);
}

// The default translations are provided from the main thread.
let defaultTranslations: Translations = {};
worker.addEventListener('message', (ev) => {
  const message = ev.data;
  if (isSetDefaultTranslationsNotification(message)) {
    defaultTranslations = message.params;
  }
});

function getDefaultTranslationsFactory() {
  return async () => defaultTranslations;
}

function getDefaultLocaleFactory() {
  return async () => 'en';
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

startServer(worker, {
  fileExists,
  findRootURI,
  getDefaultTranslationsFactory,
  getDefaultLocaleFactory,
  loadConfig,
});
