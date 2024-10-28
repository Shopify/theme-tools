import {
  AbstractFileSystem,
  Config,
  findRoot,
  loadConfig as nodeLoadConfig,
  makeFileExists,
  path,
  recursiveReadDirectory,
} from '@shopify/theme-check-node';
import { Dependencies, recommendedChecks } from '@shopify/theme-language-server-common';
import { URI, Utils } from 'vscode-uri';

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

const hasThemeAppExtensionConfig = async (rootUri: string, fs: AbstractFileSystem) => {
  const files = await recursiveReadDirectory(fs, rootUri, ([uri]) =>
    uri.endsWith('.extension.toml'),
  );
  return files.length > 0;
};

export const loadConfig: Dependencies['loadConfig'] = async function loadConfig(uriString, fs) {
  const fileUri = path.normalize(uriString);
  const fileExists = makeFileExists(fs);
  const rootUri = URI.parse(await findRoot(fileUri, fileExists));
  const scheme = rootUri.scheme;
  const configUri = Utils.joinPath(rootUri, '.theme-check.yml');
  const [configExists, isDefinitelyThemeAppExtension] = await Promise.all([
    fileExists(path.normalize(configUri)),
    hasThemeAppExtensionConfig(path.normalize(rootUri), fs),
  ]);
  if (scheme === 'file') {
    const configPath = asFsPath(configUri);
    const rootPath = asFsPath(rootUri);
    if (configExists) {
      return nodeLoadConfig(configPath, rootPath).then(normalizeRoot);
    } else if (isDefinitelyThemeAppExtension) {
      return nodeLoadConfig('theme-check:theme-app-extension', rootPath).then(normalizeRoot);
    } else {
      return nodeLoadConfig(undefined, rootPath).then(normalizeRoot);
    }
  } else {
    // We can't load configs properly in remote environments.
    // Reading and parsing YAML files is possible, but resolving `extends` and `require` fields isn't.
    // We'll do the same thing prettier does, we just won't load configs.
    return {
      checks: recommendedChecks,
      settings: {},
      context: isDefinitelyThemeAppExtension ? 'app' : 'theme',
      rootUri: path.normalize(rootUri),
    };
  }
};

function normalizeRoot(config: Config) {
  config.rootUri = path.normalize(config.rootUri);
  return config;
}
