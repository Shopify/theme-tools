import { AbsolutePath, Config } from '@shopify/theme-check-common';
import path from 'node:path';
import { resolveConfig } from './resolve';
import { themeCheckYamlToConfig } from './convert';
import { validateConfig } from './validateConfig';

/**
 * Given an absolute path to the root of a theme, this function returns
 * the validated Config object for the theme.
 *
 * In detail, it does the following:
 *  - resolves and merges extended configs,
 *  - resolves the absolute path of the root,
 *  - loads community-provided checks,
 *  - validates check settings.
 */
export async function loadConfig(
  /** The absolute path of the root of the theme */
  configPath: AbsolutePath,
  /** The root of the theme */
  root: AbsolutePath = path.dirname(configPath),
): Promise<Config> {
  const resolvedConfig = await resolveConfig(configPath);
  const config = themeCheckYamlToConfig(resolvedConfig, root);
  validateConfig(config);
  return config;
}
