import {
  AbsolutePath,
  CheckDefinition,
  Config,
  SourceCodeType,
  allChecks,
} from '@shopify/theme-check-common';
import path from 'node:path';
import { FullyResolvedThemeCheckYaml } from '../types';

const nodeModuleChecks: CheckDefinition<SourceCodeType>[] = [];

/**
 * Creates the checks array, loads node modules checks and validates
 * settings against the respective check schemas.
 *
 * @param themeCheckYaml - A flattened representation of the YAML file
 * @param root - absolute path to root
 * @returns the ThemeCheck#Config object for that config file
 */
export function themeCheckYamlToConfig(
  themeCheckYaml: FullyResolvedThemeCheckYaml,
  root: AbsolutePath,
): Config {
  const checks: CheckDefinition<SourceCodeType>[] = allChecks
    .concat(nodeModuleChecks)
    .filter(isEnabled(themeCheckYaml));

  const settings = themeCheckYaml.checkSettings;

  return {
    settings,
    checks,
    ignore: themeCheckYaml.ignore,
    root: resolveRoot(root, themeCheckYaml.root),
  };
}

/**
 * @param root - absolute path of the config file
 * @param pathLike - resovled textual value of the `root` property from the config files
 * @returns {string} resolved absolute path of the root property
 */
export function resolveRoot(root: AbsolutePath, pathLike: string | undefined): string {
  if (pathLike === undefined) {
    return root;
  }

  if (path.isAbsolute(pathLike)) {
    throw new Error('the "root" property can only be relative');
  }

  return path.resolve(root, pathLike);
}

const isEnabled =
  (config: FullyResolvedThemeCheckYaml) => (checkDefinition: CheckDefinition<SourceCodeType>) => {
    const checkSettings = config.checkSettings[checkDefinition.meta.code];
    if (!checkSettings) return false;
    return checkSettings.enabled;
  };
