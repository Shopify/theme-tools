import {
  Config,
  NodeFileSystem,
  Translations,
  isError,
  loadConfig as loadConfigFromPath,
  makeFileExists,
  memoize,
  parseJSON,
  path,
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

export const fileExists = makeFileExists(NodeFileSystem);

export const findRootURI: Dependencies['findRootURI'] = async function findRootURI(uriString) {
  return reusableFindRoot(uriString, fileExists);
};

const hasThemeAppExtensionConfig = memoize(
  async (rootPath: string) => {
    const files = await glob('*.extension.toml', { cwd: rootPath });
    return files.length > 0;
  },
  (x: string) => x,
);

export const loadConfig: Dependencies['loadConfig'] = async function loadConfig(uriString: string) {
  const fileUri = path.normalize(uriString);
  const rootUri = URI.parse(await findRootURI(fileUri));
  const rootPath = rootUri.fsPath;
  const configUri = Utils.joinPath(rootUri, '.theme-check.yml');
  const configPath = asFsPath(configUri);
  const [configExists, isDefinitelyThemeAppExtension] = await Promise.all([
    fileExists(path.normalize(configUri)),
    hasThemeAppExtensionConfig(rootUri.fsPath),
  ]);
  if (configExists) {
    return loadConfigFromPath(configPath, rootPath).then(normalizeRoot);
  } else if (isDefinitelyThemeAppExtension) {
    return loadConfigFromPath('theme-check:theme-app-extension', rootPath).then(normalizeRoot);
  } else {
    return loadConfigFromPath(undefined, rootPath).then(normalizeRoot);
  }
};

function normalizeRoot(config: Config) {
  config.rootUri = path.normalize(config.rootUri);
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
