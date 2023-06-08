import path from 'node:path';
import { AbsolutePath, Config } from '@shopify/theme-check-common';
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
  configPath: AbsolutePath | undefined,
  /** The root of the theme */
  root: AbsolutePath | undefined = configPath ? path.dirname(configPath) : undefined,
): Promise<Config> {
  if (!root) throw new Error('loadConfig cannot be called without a root argument');
  const configDescription = await resolveConfig(configPath ?? 'theme-check:recommended', true);
  const config = loadConfigDescription(configDescription, root);
  validateConfig(config);
  return config;
}
