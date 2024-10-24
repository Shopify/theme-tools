import { URI, Utils } from 'vscode-uri';
import { AbstractFileSystem, FileTuple, FileType, UriString } from './AbstractFileSystem';
import { parseJSON } from './json';
import { join } from './path';
import { SourceCodeType, Theme, Translations } from './types';
import { isError } from './utils';

export const makeFileExists = (fs: AbstractFileSystem) =>
  async function fileExists(uri: string) {
    try {
      await fs.stat(uri);
      return true;
    } catch (e) {
      return false;
    }
  };

export const makeFileSize = (fs: AbstractFileSystem) =>
  async function fileSize(uri: string) {
    try {
      const stats = await fs.stat(uri);
      return stats.size;
    } catch (error) {
      return 0;
    }
  };

export const makeGetDefaultLocale = getDefaultLocaleFactoryFactory('.default.json');
export const makeGetDefaultSchemaLocale = getDefaultLocaleFactoryFactory('.default.schema.json');
function getDefaultLocaleFactoryFactory(postfix = '.default.json') {
  return function getDefaultLocaleFactory(fs: AbstractFileSystem, rootUri: string) {
    return cached(() => getDefaultLocale(fs, rootUri, postfix));
  };
}

export const makeGetDefaultTranslations = getDefaultTranslationsFactoryFactory('.default.json');
export const makeGetDefaultSchemaTranslations =
  getDefaultTranslationsFactoryFactory('.default.schema.json');
// prettier-ignore
function getDefaultTranslationsFactoryFactory(postfix = '.default.json') {
  return function getDefaultTranslationsFactory(fs: AbstractFileSystem, theme: Theme, rootUri: string) {
    return cached(() => getDefaultTranslations(fs, theme, rootUri, postfix));
  };
}

async function getDefaultLocaleFile(
  fs: AbstractFileSystem,
  rootUri: string,
  postfix = '.default.json',
) {
  const files = await fs.readDirectory(join(rootUri, 'locales'));
  return files.find(([uri]) => uri.endsWith(postfix))?.[0];
}

async function getDefaultLocale(
  fs: AbstractFileSystem,
  rootUri: string,
  postfix: string,
): Promise<string> {
  try {
    const defaultLocaleFile = await getDefaultLocaleFile(fs, rootUri, postfix);
    if (!defaultLocaleFile) return 'en';
    const defaultLocaleFileName = Utils.basename(URI.parse(defaultLocaleFile));
    return defaultLocaleFileName.split('.')[0];
  } catch (error) {
    console.error(error);
    return 'en';
  }
}

async function getDefaultTranslations(
  fs: AbstractFileSystem,
  theme: Theme,
  rootUri: string,
  postfix: string,
): Promise<Translations> {
  try {
    const bufferTranslations = getDefaultTranslationsFromBuffer(theme, postfix);
    if (bufferTranslations) return bufferTranslations;
    const defaultLocaleFile = await getDefaultLocaleFile(fs, rootUri, postfix);
    if (!defaultLocaleFile) return {};
    const defaultTranslationsFile = await fs.readFile(defaultLocaleFile);
    return parseJSON(defaultTranslationsFile, {});
  } catch (error) {
    console.error(error);
    return {};
  }
}

/** It might be that you have an open buffer, we prefer translations from there if available */
function getDefaultTranslationsFromBuffer(theme: Theme, postfix: string): Translations | undefined {
  const defaultTranslationsSourceCode = theme.find(
    (sourceCode) =>
      sourceCode.type === SourceCodeType.JSON &&
      sourceCode.uri.match(/locales/) &&
      sourceCode.uri.endsWith(postfix),
  );
  if (!defaultTranslationsSourceCode) return undefined;
  const translations = parseJSON(defaultTranslationsSourceCode.source);
  if (isError(translations)) return undefined;
  return translations;
}

function cached<T>(fn: () => Promise<T>): () => Promise<T>;
function cached<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
  let cachedPromise: Promise<T>;
  return async (...args) => {
    if (!cachedPromise) cachedPromise = fn(...args);
    return cachedPromise;
  };
}

export async function recursiveReadDirectory(
  fs: AbstractFileSystem,
  uri: string,
  filter: (fileTuple: FileTuple) => boolean,
): Promise<UriString[]> {
  const allFiles = await fs.readDirectory(uri);
  const files = allFiles.filter((ft) => !isIgnored(ft) && (isDirectory(ft) || filter(ft)));

  const results = await Promise.all(
    files.map((ft) => {
      if (isDirectory(ft)) {
        return recursiveReadDirectory(fs, ft[0], filter);
      } else {
        return Promise.resolve([ft[0]]);
      }
    }),
  );

  return results.flat();
}

export function isDirectory([_, type]: FileTuple) {
  return type === FileType.Directory;
}

const ignoredFolders = ['.git', 'node_modules', 'dist', 'build', 'tmp', 'vendor'];

function isIgnored([uri, type]: FileTuple) {
  return type === FileType.Directory && ignoredFolders.some((folder) => uri.endsWith(folder));
}
