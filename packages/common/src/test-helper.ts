import { toLiquidHtmlAST } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import toJSON from 'json-to-ast';

import {
  check as coreCheck,
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
): LiquidSourceCode | JSONSourceCode | undefined {
  try {
    const isLiquid = relativePath.endsWith('.liquid');

    if (isLiquid) {
      return {
        absolutePath: '/' + relativePath,
        relativePath,
        source,
        type: SourceCodeType.LiquidHtml,
        ast: toLiquidHtmlAST(source),
      };
    } else {
      return {
        absolutePath: '/' + relativePath,
        relativePath,
        source,
        type: SourceCodeType.JSON,
        ast: toJSON(source),
      };
    }
  } catch (e) {
    return undefined;
  }
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
  const fileKVs: [
    string,
    LiquidSourceCode | JSONSourceCode | undefined,
  ][] = Object.entries(themeDesc).map(([relativePath, source]) => [
    relativePath,
    toSourceCode(relativePath, source),
  ]);
  return {
    files: new Map(
      fileKVs.filter(([, v]) => !!v) as [
        string,
        LiquidSourceCode | JSONSourceCode,
      ][],
    ),
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
  return coreCheck(theme, config);
}
