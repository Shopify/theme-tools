import {
  Config,
  PathHandler,
  Translations,
  isError,
  loadConfig as loadConfigFromPath,
  memoize,
  parseJSON,
  reusableFindRoot,
} from '@shopify/theme-check-node';
import { Dependencies } from '@shopify/theme-language-server-common';
import { glob as callbackGlob } from 'glob';
import * as fs from 'node:fs/promises';
import { basename } from 'node:path';
import { promisify } from 'node:util';
import { URI, Utils } from 'vscode-uri';

const glob = promisify(callbackGlob);

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
  } else if (/^file:/i.test(uriOrPath)) {
    return URI.parse(uriOrPath).fsPath;
  } else {
    return URI.file(uriOrPath).fsPath;
  }
}

const UriPathHandler: PathHandler<URI> = {
  join(base: URI, ...paths: string[]): string {
    return asFsPath(Utils.joinPath(base, ...paths));
  },

  dirname(uri: URI): URI {
    return Utils.dirname(uri);
  },

  asPath(uri: URI): string {
    return asFsPath(uri);
  },
};

async function findRoot(curr: URI): Promise<URI> {
  return reusableFindRoot(curr, UriPathHandler);
}

export const filesForURI: NonNullable<Dependencies['filesForURI']> = async function filesForURI(
  uriString,
) {
  const config = await loadConfig(uriString);
  const rootPath = asFsPath(config.rootUri);
  return glob(`**/*.{liquid,json}`, { cwd: rootPath, ignore: 'node_modules/**' });
};

export const findRootURI: Dependencies['findRootURI'] = async function findRootURI(uriString) {
  const uri = parse(uriString);
  const root = await findRoot(uri);
  return root.toString();
};

export async function fileExists(path: string): Promise<boolean> {
  try {
    // This will get called within theme-check-common which assumes
    // forward-slashes. We need to denormalize those here.
    await fs.stat(asFsPath(path));
    return true;
  } catch {
    return false;
  }
}

const hasThemeAppExtensionConfig = memoize(
  async (rootPath: string) => {
    const files = await glob('*.extension.toml', { cwd: rootPath });
    return files.length > 0;
  },
  (x: string) => x,
);

export const loadConfig: Dependencies['loadConfig'] = async function loadConfig(uriString: string) {
  const fileUri = parse(uriString);
  const rootUri = await findRoot(fileUri);
  const rootPath = asFsPath(rootUri);
  const configUri = Utils.joinPath(rootUri, '.theme-check.yml');
  const configPath = asFsPath(configUri);
  const [configExists, isDefinitelyThemeAppExtension] = await Promise.all([
    fileExists(configPath),
    hasThemeAppExtensionConfig(rootPath),
  ]);
  if (configExists) {
    return loadConfigFromPath(configPath, rootPath).then(normalizeRoot);
  } else if (isDefinitelyThemeAppExtension) {
    return loadConfigFromPath('theme-check:theme-app-extension', rootPath).then(normalizeRoot);
  } else {
    return loadConfigFromPath(undefined, rootPath).then(normalizeRoot);
  }
};

export const getDefaultTranslationsFactoryFactory =
  (postfix: string = '.default.json') =>
  (rootURI: string) => {
    const root = parse(rootURI);

    return cached(async () => {
      try {
        const defaultLocale = await getDefaultLocale(root, postfix);
        const defaultTranslationsFileUri = Utils.joinPath(
          root,
          'locales',
          `${defaultLocale}${postfix}`,
        );
        const defaultTranslationsFile = await fs.readFile(
          asFsPath(defaultTranslationsFileUri),
          'utf8',
        );
        const translations = parseJSON(defaultTranslationsFile) as Translations;
        return isError(translations) ? {} : translations;
      } catch (error) {
        return {};
      }
    });
  };

export const getDefaultTranslationsFactory: Dependencies['getDefaultTranslationsFactory'] =
  getDefaultTranslationsFactoryFactory('.default.json');

export const getDefaultSchemaTranslationsFactory: Dependencies['getDefaultSchemaTranslationsFactory'] =
  getDefaultTranslationsFactoryFactory('.default.schema.json');

const getDefaultLocaleFactoryFactory =
  (postfix: string = '.default.json') =>
  (rootURI: string) => {
    const root = parse(rootURI);
    return cached(() => getDefaultLocale(root, postfix));
  };

export const getDefaultLocaleFactory: Dependencies['getDefaultLocaleFactory'] =
  getDefaultLocaleFactoryFactory('.default.json');

export const getDefaultSchemaLocaleFactory: Dependencies['getDefaultSchemaLocaleFactory'] =
  getDefaultLocaleFactoryFactory('.default.schema.json');

async function getDefaultLocale(rootURI: URI, postfix = '.default.json') {
  try {
    const localesFolder = Utils.joinPath(rootURI, 'locales');
    const files = await fs.readdir(asFsPath(localesFolder), {
      encoding: 'utf8',
      withFileTypes: true,
    });
    const file = files.find((dirent) => dirent.isFile() && dirent.name.endsWith(postfix));
    return file ? basename(file.name, postfix) : 'en';
  } catch (error) {
    return 'en';
  }
}

function cached<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
  let cachedPromise: Promise<T>;
  return async (...args) => {
    if (!cachedPromise) cachedPromise = fn(...args);
    return cachedPromise;
  };
}

function normalizeRoot(config: Config) {
  config.rootUri = URI.parse(config.rootUri).toString();
  return config;
}

export const getThemeSettingsSchemaForRootURI: Dependencies['getThemeSettingsSchemaForRootURI'] =
  async (rootUriString: string) => {
    try {
      const rootURI = parse(rootUriString);
      const settingsSchemaFilePath = Utils.joinPath(rootURI, 'config/settings_schema.json');
      const contents = await fs.readFile(asFsPath(settingsSchemaFilePath), 'utf8');
      const json = parseJSON(contents);
      if (isError(json) || !Array.isArray(json)) {
        throw new Error('Settings JSON file not in correct format');
      }
      return json;
    } catch (error) {
      console.error(error);
      return [];
    }
  };
