import { Dependencies } from '@shopify/liquid-language-server-common';
import { URI, Utils } from 'vscode-uri';
import { basename } from 'node:path';
import * as fs from 'node:fs/promises';
import { allChecks, Translations } from '@shopify/theme-check-common';
import { loadConfig as loadConfigFromPath } from '@shopify/theme-check-node';

function parse(uri: string): URI {
  return URI.parse(uri);
}

// uri.path is normalized to forward slashes and is an assumption we use
// inside theme-check-js
function asPath(uri: URI) {
  return uri.path;
}

// Calls to `fs` should be done with this
function asFsPath(uriOrPath: string | URI) {
  if (URI.isUri(uriOrPath)) {
    return uriOrPath.fsPath;
  } else {
    return URI.file(uriOrPath).fsPath;
  }
}

async function isRoot(dirURI: URI) {
  const [configExists, gitExists] = await Promise.all([
    fileExists(asPath(Utils.joinPath(dirURI, '.theme-check.yml'))),
    fileExists(asPath(Utils.joinPath(dirURI, '.git'))),
  ]);
  return configExists || gitExists;
}

async function findRoot(curr: URI): Promise<URI> {
  const currIsRoot = await isRoot(curr);
  if (currIsRoot) {
    return curr;
  }

  const dirURI = Utils.dirname(curr);
  const currIsAbsoluteRoot = dirURI.fsPath === curr.fsPath;
  if (currIsAbsoluteRoot) {
    return curr;
  }

  return findRoot(dirURI);
}

export const findRootURI: Dependencies['findRootURI'] = async function findRootURI(uriString) {
  const uri = parse(uriString);
  const root = await findRoot(uri);
  return root.toString();
};

export const fileExists: Dependencies['fileExists'] = async function fileExists(path) {
  try {
    // This will get called within theme-check-common which assumes
    // forward-slashes. We need to denormalize those here.
    await fs.stat(asFsPath(path));
    return true;
  } catch (e) {
    return false;
  }
};

export const fileSize: Dependencies['fileSize'] = async function fileSize(
  absolutePath: string,
): Promise<number> {
  try {
    const stats = await fs.stat(asFsPath(absolutePath));
    return stats.size;
  } catch (e) {
    throw new Error(`Failed to get file size: ${e}`);
  }
};

export const loadConfig: Dependencies['loadConfig'] = async function (uriString: string) {
  const fileUri = parse(uriString);
  const rootUri = await findRoot(fileUri);
  const rootPath = asPath(rootUri);
  const configUri = Utils.joinPath(rootUri, '.theme-check.yml');
  const configPath = asPath(configUri);
  if (await fileExists(configPath)) {
    return loadConfigFromPath(configPath, rootPath);
  } else {
    return loadConfigFromPath(undefined, rootPath);
  }
};

export const getDefaultTranslationsFactory: Dependencies['getDefaultTranslationsFactory'] =
  function getDefaultTranslationsFactory(rootURI) {
    const root = parse(rootURI);
    let cachedPromise: Promise<Translations>;

    async function getDefaultTranslations() {
      try {
        const defaultLocale = await getDefaultLocale(root);
        const defaultTranslationsFileUri = Utils.joinPath(
          root,
          'locales',
          `${defaultLocale}.default.json`,
        );
        const defaultTranslationsFile = await fs.readFile(
          asFsPath(defaultTranslationsFileUri),
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
  };

export const getDefaultLocaleFactory: Dependencies['getDefaultLocaleFactory'] =
  function getDefaultLocaleFactory(rootURI: string) {
    const root = parse(rootURI);
    let cachedPromise: Promise<string>;

    return async () => {
      if (!cachedPromise) cachedPromise = getDefaultLocale(root);
      return cachedPromise;
    };
  };

async function getDefaultLocale(rootURI: URI) {
  try {
    const localesFolder = Utils.joinPath(rootURI, 'locales');
    const files = await fs.readdir(asFsPath(localesFolder), {
      encoding: 'utf8',
      withFileTypes: true,
    });
    const defaultLocaleEntry = files.find(
      (dirent) => dirent.isFile() && dirent.name.endsWith('.default.json'),
    );
    return defaultLocaleEntry ? basename(defaultLocaleEntry.name, '.default.json') : 'en';
  } catch (error) {
    return 'en';
  }
}
