import {
  AbsolutePath,
  CheckDefinition,
  Config,
  SourceCodeType,
  allChecks,
} from '@shopify/theme-check-common';
import path from 'node:path';
import { fileExists } from '../file-utils';
import { loadThirdPartyChecks } from './load-third-party-checks';
import { ConfigDescription } from './types';

/**
 * Creates the checks array, loads node modules checks and validates
 * settings against the respective check schemas.
 *
 * Effectively "loads" a ConfigDescription into a Config.
 */
export async function loadConfigDescription(
  configDescription: ConfigDescription,
  root: AbsolutePath,
): Promise<Config> {
  const nodeModuleRoot = await findNodeModuleRoot(root);
  const thirdPartyChecks = await loadThirdPartyChecks(nodeModuleRoot, configDescription.require);
  const checks: CheckDefinition<SourceCodeType>[] = allChecks
    .concat(thirdPartyChecks)
    .filter(isEnabledBy(configDescription));

  const settings = configDescription.checkSettings;

  return {
    settings,
    checks,
    ignore: configDescription.ignore,
    root: resolveRoot(root, configDescription.root),
  };
}

/**
 * @param root - absolute path of the config file
 * @param pathLike - resolved textual value of the `root` property from the config files
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

const isEnabledBy =
  (config: ConfigDescription) => (checkDefinition: CheckDefinition<SourceCodeType>) => {
    const checkSettings = config.checkSettings[checkDefinition.meta.code];
    if (!checkSettings) return false;
    return checkSettings.enabled;
  };

async function isNodeModuleRoot(root: AbsolutePath) {
  // is absolute absolute root
  if (path.dirname(root) === root) {
    return true;
  }

  const [isNodeModuleRoot, isGitRoot] = await Promise.all([
    fileExists(path.join(root, 'node_modules')),
    fileExists(path.join(root, '.git')),
  ]);
  return isNodeModuleRoot || isGitRoot;
}

async function findNodeModuleRoot(root: AbsolutePath) {
  let curr = root;
  while (!(await isNodeModuleRoot(curr))) {
    curr = path.dirname(curr);
  }
  return curr;
}
