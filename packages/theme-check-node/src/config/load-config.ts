import { Config } from '@shopify/theme-check-common';
import { AbsolutePath } from '../temp';
import { loadConfigDescription } from './load-config-description';
import { resolveConfig } from './resolve';
import { ModernIdentifier } from './types';
import { validateConfig } from './validation';
import fs from 'fs/promises';

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
  configPath: AbsolutePath | ModernIdentifier | undefined,
  /** The root of the theme */
  root: AbsolutePath,
): Promise<Config> {
  if (!root) throw new Error('loadConfig cannot be called without a root argument');
  let defaultChecks = 'theme-check:recommended';

  if (!configPath) {
    const files = await fs.readdir(root);
    // *.extension.toml implies that we're already in the appropriate extensions
    // directory. *.app.toml implies that we're inside the root of an app.
    if (files.some((file) => file.endsWith('.extension.toml') || file.endsWith('.app.toml'))) {
      defaultChecks = 'theme-check:theme-app-extension';
    }
  }

  const configDescription = await resolveConfig(configPath ?? defaultChecks, true);
  const config = await loadConfigDescription(configDescription, root);
  validateConfig(config);
  return config;
}
