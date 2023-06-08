import { AbsolutePath, CheckSettings, Severity } from '@shopify/theme-check-common';
import { parse } from 'yaml';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  LegacyIdentifiers,
  ConvenienceSeverities,
  ConvenienceSeverity,
  ModernIdentifier,
  ConfigFragment,
} from '../types';

/**
 * Takes an absolute path, parses the yaml at that path and turns it into a
 * ConfigFragment object.
 */
export async function readYamlConfigDescription(
  /** the absolute path to a theme-check.yml file */
  absolutePath: AbsolutePath,
  /** only the root config has `extends: theme-check:recommended` by default, it's nothing everywhere else */
  isRootConfig: boolean = false,
): Promise<ConfigFragment> {
  const root = path.dirname(absolutePath);
  const contents = await fs.readFile(absolutePath, 'utf8');
  const yamlFile = parse(contents);

  if (!isPlainObject(yamlFile)) {
    throw new Error(
      `Expecting parsed contents of config file at path '${absolutePath}' to be a plain object`,
    );
  }

  const config: ConfigFragment = {
    checkSettings: {},
    ignore: [],
    extends: [],
  };

  if (yamlFile.root) {
    config.root = yamlFile.root;
    delete yamlFile.root;
  }

  if (yamlFile.ignore) {
    config.ignore = asArray(yamlFile.ignore);
    delete yamlFile.ignore;
  }

  if (yamlFile.extends) {
    config.extends = asArray(yamlFile.extends)
      .map((pathLike: string) => resolveExtends(root, pathLike))
      .filter(isString);
    delete yamlFile.extends;
  } else if (isRootConfig) {
    config.extends = [resolveExtends(root, 'theme-check:recommended')!];
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
 * resolves the `extends:` property of configuration files.
 *
 * pathLike can be any of the following:
 * - legacy identifiers:
 *   - a symbol (e.g. :default, :nothing, :theme_app_extension)
 *   - the special string version of the symbols (e.g. default, nothing)
 * - modern identifiers:
 *   - theme-check:all
 *   - theme-check:recommended
 *   - theme-check:theme-app-extension
 *   - a node_module (e.g. '@acme/theme-check-recommended')
 *   - a relative path (e.g. '../configurations/theme-check.yml')
 *
 * @returns {string} resolved absolute path of the extended config
 */
function resolveExtends(
  /** absolute path of the config file */
  root: string,
  /** pathLike textual value of the `extends` property in the config file */
  pathLike: string,
): ModernIdentifier | string | undefined {
  if (pathLike.startsWith(':') || LegacyIdentifiers.has(pathLike)) {
    return LegacyIdentifiers.get(pathLike.replace(/^:/, '')) as ModernIdentifier | undefined;
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
 * Resolves the check settings. Will also camelCase the snake_case settings
 * for backwards compatibility.
 */
function resolveSettings(
  /** key value pair of settings for a check */
  settings: { [k in string]: any },
): CheckSettings {
  const resolvedSettings: CheckSettings = {
    enabled: settings.enabled || true,
  };

  for (const [key, value] of Object.entries(settings)) {
    resolvedSettings[toCamelCase(key)] = value;
  }

  if (
    settings.ignore !== undefined &&
    Array.isArray(settings.ignore) &&
    settings.ignore.every(isString)
  ) {
    resolvedSettings.ignore = settings.ignore;
  }

  if (settings.severity !== undefined) {
    resolvedSettings.severity = resolveSeverity(settings.severity);
  }

  return resolvedSettings;
}

function resolveSeverity(severity: unknown): Severity {
  if (isConvenienceSeverity(severity)) return ConvenienceSeverities[severity];
  if (isSeverity(severity)) return severity;
  throw new Error(
    `Unsupported severity: ${severity}. Try one of ${Object.keys(ConvenienceSeverities)}`,
  );
}

function isConvenienceSeverity(severity: unknown): severity is ConvenienceSeverity {
  return typeof severity === 'string' && severity in ConvenienceSeverities;
}

function isSeverity(severity: unknown): severity is Severity {
  return typeof severity === 'number' && severity in Severity;
}

function toCamelCase(maybeSnakeCaseStr: string): string {
  return maybeSnakeCaseStr.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function isPlainObject(thing: unknown): thing is { [k in string]: any } {
  return Object.prototype.toString.call(thing) === '[object Object]';
}

function isString(thing: unknown): thing is string {
  return typeof thing === 'string';
}

function asArray<T>(thing: T | T[]): T[] {
  return Array.isArray(thing) ? thing : [thing];
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
