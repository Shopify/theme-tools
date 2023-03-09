import { toLiquidHtmlAST } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import toJSON from 'json-to-ast';

import { SourceCodeType, JSONSourceCode, LiquidSourceCode } from './types';

export function toSourceCode(
  relativePath: string,
  absolutePath: string,
  source: string,
  version?: number,
): LiquidSourceCode | JSONSourceCode | undefined {
  try {
    const isLiquid = relativePath.endsWith('.liquid');

    if (isLiquid) {
      return {
        absolutePath,
        relativePath,
        source,
        type: SourceCodeType.LiquidHtml,
        ast: toLiquidHtmlAST(source),
        version,
      };
    } else {
      return {
        absolutePath,
        relativePath,
        source,
        type: SourceCodeType.JSON,
        ast: toJSON(source),
        version,
      };
    }
  } catch (e) {
    return undefined;
  }
}
