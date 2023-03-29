import { toLiquidHtmlAST } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import toJSON from 'json-to-ast';

import { SourceCodeType, JSONSourceCode, LiquidSourceCode } from './types';

export function toSourceCode(
  absolutePath: string,
  source: string,
  version?: number,
): LiquidSourceCode | JSONSourceCode | undefined {
  try {
    const isLiquid = absolutePath.endsWith('.liquid');

    if (isLiquid) {
      return {
        absolutePath,
        source,
        type: SourceCodeType.LiquidHtml,
        ast: toLiquidHtmlAST(source),
        version,
      };
    } else {
      return {
        absolutePath,
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
