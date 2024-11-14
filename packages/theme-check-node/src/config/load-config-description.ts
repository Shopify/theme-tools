import {
  CheckDefinition,
  Config,
  SourceCodeType,
  allChecks,
  path as pathUtils,
} from '@shopify/theme-check-common';
import path from 'node:path';
import { fileExists } from '../file-utils';
import { AbsolutePath } from '../temp';
import { thisNodeModuleRoot } from './installation-location';
import { findThirdPartyChecks, loadThirdPartyChecks } from './load-third-party-checks';
import { ConfigDescription } from './types';
import { URI, Utils } from 'vscode-uri';

const flatten = <T>(arrs: T[][]): T[] => arrs.flat();

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
  const thirdPartyChecksPaths = await Promise.all([
    findThirdPartyChecks(thisNodeModuleRoot()), // global checks
    findThirdPartyChecks(nodeModuleRoot),
  ]).then(flatten);
  const thirdPartyChecks = loadThirdPartyChecks([
    ...configDescription.require,
    ...thirdPartyChecksPaths,
  ]);
  const checks: CheckDefinition<SourceCodeType>[] = allChecks
    .concat(thirdPartyChecks)
    .filter(isEnabledBy(configDescription));

  const rootUri = URI.file(root);
  return {
    settings: unaliasedSettings(configDescription.checkSettings, checks),
    context: configDescription.context ?? 'theme',
    checks,
    ignore: configDescription.ignore,
    rootUri: resolveRoot(rootUri, configDescription.root),
  };
}

/**
 * @param root - absolute path of the config file
 * @param pathLike - resolved textual value of the `root` property from the config files
 * @returns {string} resolved URI of the root property
 */
function resolveRoot(root: URI, pathLike: string | undefined): string {
  if (pathLike === undefined) {
    return pathUtils.normalize(root);
  }

  if (path.isAbsolute(pathLike)) {
    throw new Error('the "root" property can only be relative');
  }

  return pathUtils.resolve(root, pathLike);
}

const isEnabledBy =
  (config: ConfigDescription) => (checkDefinition: CheckDefinition<SourceCodeType>) => {
    const checkSettings =
      config.checkSettings[checkDefinition.meta.code] ?? aliasedSettings(config, checkDefinition);
    if (!checkSettings) return false;
    return checkSettings.enabled;
  };

function aliasedSettings(
  config: ConfigDescription,
  checkDefinition: CheckDefinition<SourceCodeType>,
) {
  if (!checkDefinition.meta.aliases) return undefined;
  const usedAlias = checkDefinition.meta.aliases.find((alias) => config.checkSettings[alias]);
  if (!usedAlias) return undefined;
  return config.checkSettings[usedAlias];
}

function unaliasedSettings(
  settings: ConfigDescription['checkSettings'],
  checks: CheckDefinition<SourceCodeType>[],
): ConfigDescription['checkSettings'] {
  return Object.fromEntries(
    Object.entries(settings).map(([code, value]) => {
      return [unaliasedCode(code, checks), value];
    }),
  );
}

function unaliasedCode(code: string, checks: CheckDefinition<SourceCodeType>[]) {
  const check = checks.find(
    (check) => check.meta.code === code || check.meta.aliases?.find((alias) => alias === code),
  );
  return check?.meta.code;
}

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
