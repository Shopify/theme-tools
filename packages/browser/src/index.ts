import {
  Config,
  JSONSourceCode,
  LiquidSourceCode,
  Offense,
  Theme,
  allChecks,
  check as coreCheck,
  toSourceCode,
  recommended,
} from '@shopify/theme-check-common';

export { toSourceCode, allChecks, recommended, Config };

/**
 * @example
 * {
 *   'theme/layout.liquid': `
 *     <html>
 *       {{ content_for_page }}
 *     </html>
 *   `,
 *   'snippets/snip.liquid': `
 *     <b>'hello world'</b>
 *   `,
 * }
 */
export type ThemeData = {
  [relativePath in string]: string;
};

export function getTheme(themeDesc: ThemeData): Theme {
  const fileKVs: [string, LiquidSourceCode | JSONSourceCode | undefined][] = Object.entries(
    themeDesc,
  ).map(([relativePath, source]) => [
    relativePath,
    toSourceCode('/' + relativePath, relativePath, source),
  ]);
  return {
    files: new Map(fileKVs.filter(([, v]) => !!v) as [string, LiquidSourceCode | JSONSourceCode][]),
  };
}

/**
 * In the event where you don't care about reusing your Theme object, simpleCheck works alright.
 *
 * But if you want to manage your memory (e.g. don't reparse ASTs for files that were not modified),
 * it might be preferable to call coreCheck directly.
 */
export async function simpleCheck(themeDesc: ThemeData, config: Config): Promise<Offense[]> {
  const theme = getTheme(themeDesc);
  return coreCheck(theme, config);
}

export { coreCheck };
