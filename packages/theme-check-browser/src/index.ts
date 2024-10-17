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
  Dependencies,
  AbstractFileSystem,
  FileStat,
  FileTuple,
  FileType,
} from '@shopify/theme-check-common';

export {
  toSourceCode,
  allChecks,
  recommended,
  Config,
  Dependencies,
  AbstractFileSystem,
  FileStat,
  FileTuple,
  FileType,
};

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
  return Object.entries(themeDesc)
    .map(([relativePath, source]) => toSourceCode(toUri(relativePath), source))
    .filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}

/**
 * In the event where you don't care about reusing your SourceCode objects, simpleCheck works alright.
 *
 * But if you want to manage your memory (e.g. don't reparse ASTs for files that were not modified),
 * it might be preferable to call coreCheck directly.
 */
export async function simpleCheck(
  themeDesc: ThemeData,
  config: Config,
  dependencies: Dependencies,
): Promise<Offense[]> {
  const theme = getTheme(themeDesc);
  return coreCheck(theme, config, dependencies);
}

export { coreCheck };

function toUri(relativePath: string) {
  return 'browser:/' + relativePath;
}
