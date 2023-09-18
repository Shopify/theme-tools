import path from 'node:path';
import { AbsolutePath } from '@shopify/theme-check-common';
import { readYamlConfigDescription } from './read-yaml';
import { mergeFragments } from './merge-fragments';
import { ConfigDescription, ModernIdentifier, ModernIdentifiers } from '../types';

const modernConfigsPath = () => {
  if (process.env.WEBPACK_MODE) {
    return path.resolve(__dirname, './configs');
  } else {
    return path.resolve(__dirname, '../../../configs');
  }
};

/**
 * Given a modern identifier or absolute path, fully resolves and flattens
 * a config description. In other words, extends are all loaded and merged with
 * the config at the configPath.
 */
export async function resolveConfig(
  configPath: AbsolutePath | ModernIdentifier,
  isRootConfig: boolean = false,
): Promise<ConfigDescription> {
  if (isModernIdentifier(configPath)) {
    const modernConfigPath = path.join(
      modernConfigsPath(),
      configPath.replace(/^theme-check:/, '') + '.yml',
    );
    return resolveConfig(modernConfigPath);
  }

  // TODO: Add support for more file formats.
  const current = await readYamlConfigDescription(configPath, isRootConfig);
  const baseConfigs = await Promise.all(current.extends.map((extend) => resolveConfig(extend)));
  return mergeFragments(baseConfigs, current);
}

function isModernIdentifier(thing: string): thing is ModernIdentifier {
  return ModernIdentifiers.includes(thing as any);
}
