import { parse } from 'yaml';
import path from 'node:path';
import fs from 'node:fs/promises';

type CheckSettings = {
  enabled: boolean;
  ignore: string[];
} & {
  [key in string]: any;
};

export interface ThemeCheckYaml {
  root: string;
  ignore?: string[];
  extends?: string | string[];
  checkSettings: {
    [code in string]: CheckSettings;
  };
}

export async function loadYamlConfig(absolutePath: string): Promise<ThemeCheckYaml> {
  const root = path.dirname(absolutePath);
  const contents = await fs.readFile(absolutePath, 'utf8');
  const yamlFile = parse(contents);

  if (!isPlainObject(yamlFile)) {
    throw new Error(
      `Expecting parsed contents of config file at path '${absolutePath}' to be a plain object`,
    );
  }

  const config: ThemeCheckYaml = {
    root: resolveRoot(root, yamlFile.root),
    checkSettings: {},
  };

  if (yamlFile.root) {
    delete yamlFile.root;
  }

  if (yamlFile.ignore) {
    config.ignore = Array.isArray(yamlFile.ignore) ? yamlFile.ignore : [yamlFile.ignore];
    delete yamlFile.ignore;
  }

  if (yamlFile.extends) {
    config.extends = Array.isArray(yamlFile.extends)
      ? yamlFile.extends
          .map((pathLike: string) => resolveExtends(root, pathLike))
          .filter((x): x is string => typeof x === 'string')
      : resolveExtends(root, yamlFile.extends);
    delete yamlFile.extends;
  }

  for (const [checkName, settings] of Object.entries(yamlFile)) {
    if (!isPlainObject(settings)) {
      throw new Error(`Expected a plain object value for ${checkName} but got ${typeof settings}`);
    }

    config.checkSettings[checkName] = resolveSettings(settings);
  }

  return config;
}

/**
 * resolveRoot
 *
 * @param root - absolute path of the config file
 * @param pathLike - textual value of the `root` property in the config file
 * @returns {string} resolved absolute path of the root property
 */
function resolveRoot(root: string, pathLike: string | undefined): string {
  if (pathLike === undefined) {
    return root;
  }

  if (path.isAbsolute(pathLike)) {
    throw new Error('the `root` property can only be relative');
  }

  return path.resolve(root, pathLike);
}

const LegacyIdentifiers = new Map(
  Object.entries({
    default: 'theme-check:recommended',
    nothing: undefined,
    theme_app_extensions: 'theme-check:theme-app-extensions',
  }),
);

/**
 * resolveExtends
 *
 * resolves the `extends:` property of configuration files.
 *
 * pathLike can be any of the following:
 *   - legacy identifiers:
 *   - a symbol (e.g. :default, :nothing, :theme_app_extension)
 *   - the special string version of the symbols (default, nothing, theme_app_extension)
 * - modern identifiers:
 *   - theme-check:recommended
 *   - theme-check:all
 *   - a node_module (e.g. '@acme/theme-check-recommended')
 *   - a relative path (e.g. '../configurations/theme-check.yml')
 *
 * @param root - absolute path of the config file
 * @param pathLike - textual value of the `extends` property in the config file
 * @returns {string} resolved absolute path of the extended config
 */
function resolveExtends(root: string, pathLike: string): string | undefined {
  if (pathLike.startsWith(':') || LegacyIdentifiers.has(pathLike)) {
    return LegacyIdentifiers.get(pathLike.replace(/^:/, ''));
  }

  if (pathLike.startsWith('theme-check:')) {
    return pathLike;
  }

  if (path.isAbsolute(pathLike)) {
    return pathLike;
  }

  if (pathLike.startsWith('.')) {
    return path.resolve(root, pathLike);
  }

  return require.resolve(pathLike, { paths: getAncestorNodeModules(root)! });
}

/**
 * resolveSettings
 *
 * resolves the check settings. Will also camelCase the snake_case settings
 * for backwards compatibility.
 *
 * @param settings - key value pair of settings for a check
 * @returns {CheckSettings} resolved settings with camel cased keys
 */
function resolveSettings(settings: { [k in string]: any }): CheckSettings {
  const resolvedSettings: CheckSettings = {
    enabled: settings.enabled || true,
    ignore: settings.ignore && Array.isArray(settings.ignore) ? settings.ignore : [],
  };

  for (const [key, value] of Object.entries(settings)) {
    resolvedSettings[toCamelCase(key)] = value;
  }

  return resolvedSettings;
}

function toCamelCase(maybeSnakeCaseStr: string): string {
  return maybeSnakeCaseStr.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function isPlainObject(thing: unknown): thing is { [k in string]: any } {
  return Object.prototype.toString.call(thing) === '[object Object]';
}

function getAncestorNodeModules(dir: string): string[] {
  const root = path.parse(dir).root;
  const nodeModulesPaths: string[] = [];

  while (dir !== root) {
    nodeModulesPaths.push(path.join(dir, 'node_modules'));
    dir = path.dirname(dir);
  }

  return nodeModulesPaths;
}
