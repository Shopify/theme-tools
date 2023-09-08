import { AbsolutePath, CheckDefinition, SourceCodeType } from '@shopify/theme-check-common';
import glob from 'glob';
import { promisify } from 'node:util';

const asyncGlob = promisify(glob);

type ModulePath = string;

export function loadThirdPartyChecks(
  /**
   * An array of require()-able paths.
   * @example
   * [
   *   '@acme/theme-check-extension',
   *   '/absolute/path/to/checks.js',
   *   './lib/checks.js',
   * ]
   * */
  modulePaths: ModulePath[] = [],
): CheckDefinition<SourceCodeType>[] {
  const checks = [];
  for (const modulePath of modulePaths) {
    try {
      const moduleValue = require(/* webpackIgnore: true */ modulePath);
      const moduleChecks = moduleValue.checks as unknown;
      if (!Array.isArray(moduleChecks)) {
        throw new Error(
          `Expected the 'checks' export to be an array and got ${typeof moduleChecks}`,
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
      console.error(`Error loading ${modulePath}, ignoring it.\n${e}`);
    }
  }
  return checks;
}

export async function findThirdPartyChecks(nodeModuleRoot: AbsolutePath): Promise<ModulePath[]> {
  const paths = [
    globJoin(nodeModuleRoot.replace(/\\/g, '/'), '/node_modules/theme-check-*/'),
    globJoin(nodeModuleRoot.replace(/\\/g, '/'), '/node_modules/@*/theme-check-*/'),
  ];
  const results = await Promise.all(paths.map((path) => asyncGlob(path)));
  return results
    .flat()
    .filter(
      (x) =>
        !/\@shopify\/theme-check-(node|common|browser|docs-updater)/.test(x) &&
        !/theme-check-vscode/.test(x),
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
