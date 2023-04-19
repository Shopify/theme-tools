import { startServer as startCoreServer } from '@shopify/liquid-language-server-common';
import { createConnection, URI } from 'vscode-languageserver/node';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { allChecks, Translations } from '@shopify/theme-check-common';

function asAbsolutePath(uri: URI) {
  // TODO, probably not good on Windows (USE vscode-uri)...
  return uri.replace(/^\w+:(\/+)?/, '');
}

async function isRoot(dir: string) {
  const [configExists, gitExists] = await Promise.all([
    fileExists(path.join(dir, '.theme-check.yml')),
    fileExists(path.join(dir, '.git')),
  ]);
  return configExists || gitExists;
}

async function findRoot(curr: string): Promise<string> {
  const dir = path.dirname(curr);
  const dirIsAbsoluteRoot = dir === curr;
  if (dirIsAbsoluteRoot) {
    return curr;
  }

  const dirIsRoot = await isRoot(dir);
  if (dirIsRoot) {
    return dir;
  }

  return findRoot(dir);
}

async function findRootURI(uri: URI) {
  const absolutePath = asAbsolutePath(uri);
  const protocol = /^\w+:(\/+)?/.exec(uri)?.[0];

  // TODO this is sketchy and protocol probably invalid on Windows
  if (!absolutePath.startsWith('/') || !protocol) {
    throw new Error(
      'hmm, seems like the absolute path url assumption is wrong',
    );
  }

  return `${protocol}${await findRoot(absolutePath)}`;
}

async function fileExists(absolutePath: string) {
  try {
    await fs.stat(absolutePath);
    return true;
  } catch (e) {
    return false;
  }
}

async function loadConfig(uri: URI) {
  return {
    settings: {},
    checks: allChecks, // TODO
    root: await findRoot(asAbsolutePath(uri)),
  };
}

function getDefaultTranslationsFactory(rootURI: URI) {
  const root = asAbsolutePath(rootURI);
  let cachedPromise: Promise<Translations>;

  async function getDefaultTranslations() {
    try {
      const defaultLocale = await getDefaultLocale(root);
      const defaultTranslationsFilePath = path.join(
        root,
        `locales/${defaultLocale}.default.json`,
      );
      const defaultTranslationsFile = await fs.readFile(
        defaultTranslationsFilePath,
        'utf8',
      );
      return JSON.parse(defaultTranslationsFile) as Translations;
    } catch (error) {
      return {};
    }
  }

  return async () => {
    if (!cachedPromise) cachedPromise = getDefaultTranslations();
    return cachedPromise;
  };
}

async function getDefaultLocale(root: string) {
  try {
    const localesFolder = path.join(root, 'locales');
    const files = await fs.readdir(localesFolder, {
      encoding: 'utf8',
      withFileTypes: true,
    });
    const defaultLocaleEntry = files.find(
      (dirent) => dirent.isFile() && dirent.name.endsWith('.default.json'),
    );
    return defaultLocaleEntry
      ? path.basename(defaultLocaleEntry.name, '.default.json')
      : 'en';
  } catch (error) {
    return 'en';
  }
}

function getDefaultLocaleFactory(rootURI: URI) {
  const root = asAbsolutePath(rootURI);
  let cachedPromise: Promise<string>;

  return async () => {
    if (!cachedPromise) cachedPromise = getDefaultLocale(root);
    return cachedPromise;
  };
}

export function startServer() {
  const connection = createConnection(stdin, stdout);

  startCoreServer(connection, {
    // Using console.error to not interfere with messages sent on STDIN/OUT
    log: (message: string) => console.error(message),
    getDefaultTranslationsFactory,
    getDefaultLocaleFactory,
    findRootURI,
    fileExists,
    loadConfig,
  });
}
