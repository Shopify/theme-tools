import {
  check as coreCheck,
  toSourceCode,
  Offense,
  Config,
  SourceCodeType,
  Theme,
  JSONSourceCode,
  LiquidSourceCode,
  CheckDefinition,
  recommended,
} from '@shopify/theme-check-common';

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
export type MockTheme = {
  [relativePath in string]: string;
};

export function getTheme(themeDesc: MockTheme): Theme {
  return Object.entries(themeDesc)
    .map(([relativePath, source]) => toSourceCode(asAbsolutePath(relativePath), source))
    .filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}

export async function check(
  themeDesc: MockTheme,
  checks: CheckDefinition<SourceCodeType>[] = recommended,
): Promise<Offense[]> {
  const theme = getTheme(themeDesc);
  const config: Config = {
    settings: {},
    checks: checks,
    root: '/',
  };
  return coreCheck(theme, config, {
    async fileExists(absolutePath: string) {
      const relativePath = absolutePath.replace(/^\/\//, '');
      return themeDesc[relativePath] !== undefined;
    },
    async getDefaultTranslations() {
      return JSON.parse(themeDesc['locales/en.default.json'] || '{}');
    },
  });
}

function asAbsolutePath(relativePath: string) {
  return '/' + relativePath;
}
