import { AbsolutePath, Config } from '@shopify/theme-check-common';
import path from 'node:path';
import { resolveConfig } from './resolve';
import { loadConfigDescription } from './load-config-description';
import { validateConfig } from './validation';

/**
 * Given an absolute path to a config file, this function returns
 * the validated Config object that it represents.
 *
 * In detail, it does the following:
 *  - resolves and merges extended config,
 *  - resolves the absolute path of the root,
 *  - loads community-provided checks,
 *  - validates check settings.
 */
export async function loadConfig(
  /** The absolute path of config file */
  configPath: AbsolutePath,
  /** The root of the theme */
  root: AbsolutePath = path.dirname(configPath),
): Promise<Config> {
  const configDescription = await resolveConfig(configPath);
  const config = loadConfigDescription(configDescription, root);
  validateConfig(config);
  return config;
}
