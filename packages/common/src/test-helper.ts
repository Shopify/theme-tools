import {
  check as coreCheck,
  toSourceCode as commonToSourceCode,
  Offense,
  Config,
  SourceCodeType,
  Theme,
  JSONSourceCode,
  LiquidSourceCode,
  CheckDefinition,
  recommended,
} from '@shopify/theme-check-common';

function toSourceCode(
  relativePath: string,
  source: string,
  version?: number,
): LiquidSourceCode | JSONSourceCode | undefined {
  return commonToSourceCode('/' + relativePath, relativePath, source, version);
}

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
  const fileKVs: [string, LiquidSourceCode | JSONSourceCode | undefined][] = Object.entries(
    themeDesc,
  ).map(([relativePath, source]) => [relativePath, toSourceCode(relativePath, source)]);
  return {
    files: new Map(fileKVs.filter(([, v]) => !!v) as [string, LiquidSourceCode | JSONSourceCode][]),
  };
}

export async function check(
  themeDesc: MockTheme,
  checks: CheckDefinition<SourceCodeType>[] = recommended,
): Promise<Offense[]> {
  const theme = getTheme(themeDesc);
  const config: Config = {
    settings: {},
    checks: checks,
  };
  return coreCheck(theme, config, {
    async fileExists(absolutePath: string) {
      return !!themeDesc[absolutePath.replace(/^\//, '')];
    },
    async getDefaultTranslations() {
      return JSON.parse(themeDesc['locales/en.default.json'] || '{}');
    },
  });
}
