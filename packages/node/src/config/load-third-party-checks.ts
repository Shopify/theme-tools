import { AbsolutePath, CheckDefinition, SourceCodeType } from '@shopify/theme-check-common';
import glob from 'glob';
import path from 'node:path';
import { promisify } from 'node:util';

const asyncGlob = promisify(glob);

type ModulePath = string;

export async function loadThirdPartyChecks(
  /**
   * Not to be confused with the root of the theme. A workspace could be a
   * monorepo where @shopify/cli is installed at the root. We might need to
   * be able to discover checks in node_modules in folders above the one
   * we're checking.
   */
  nodeModuleRoot: AbsolutePath,
  /**
   * The value of the `require:` array in the config file. This is for
   * folks who don't want to publish their checks to NPM or that wish to
   * debug them.
   */
  requirePaths: ModulePath[] = [],
): Promise<CheckDefinition<SourceCodeType>[]> {
  const checks = [];
  const modules = requirePaths.concat(await findThirdPartyChecks(nodeModuleRoot));
  for (const mod of modules) {
    try {
      const tpModule = require(mod);
      const moduleChecks = tpModule.checks as unknown;
      if (!Array.isArray(moduleChecks)) {
        console.error(tpModule);
        throw new Error(
          `Expected the 'checks' export to be an array and got ${typeof moduleChecks}, ${tpModule}`,
        );
      }

      for (const check of moduleChecks) {
        if (isCheckDefinition(check)) {
          checks.push(check);
        } else {
          console.error(`Expected ${check} to be a CheckDefinition, but it looks like it isn't`);
        }
      }
    } catch (e) {
      console.error(`Error loading ${mod}, ${e}. Ignoring it.`);
    }
  }
  return checks;
}

export async function findThirdPartyChecks(nodeModuleRoot: AbsolutePath): Promise<ModulePath[]> {
  const paths = [
    globJoin(nodeModuleRoot.replace(/\\/g, '/'), '**/node_modules/theme-check-*/package.json'),
    globJoin(nodeModuleRoot.replace(/\\/g, '/'), '**/node_modules/@*/theme-check-*/package.json'),
  ];
  return Promise.all(paths.map((path) => asyncGlob(path))).then((arrs) =>
    arrs
      .flat()
      .map(path.dirname)
      .filter((x) => !x.endsWith(path.join('@shopify', 'theme-check-common'))),
  );
}

function globJoin(...parts: string[]): string {
  return parts.flatMap((x) => x.replace(/\\/g, '/').replace(/\/+$/, '')).join('/');
}

function isObjLiteral(thing: unknown): thing is Record<PropertyKey, any> {
  return thing !== null && typeof thing === 'object';
}

function isCheckDefinition(thing: unknown): thing is CheckDefinition<SourceCodeType> {
  return (
    isObjLiteral(thing) &&
    'meta' in thing &&
    'create' in thing &&
    isObjLiteral(thing.meta) &&
    'code' in thing.meta
  );
}
