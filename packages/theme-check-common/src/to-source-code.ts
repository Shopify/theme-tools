import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import toJSON from 'json-to-ast';

import * as path from './path';
import { JSONSourceCode, LiquidSourceCode, SourceCodeType } from './types';
import { asError } from './utils/error';

export function toLiquidHTMLAST(source: string) {
  try {
    return toLiquidHtmlAST(source);
  } catch (error) {
    return asError(error);
  }
}

export function toJSONAST(source: string) {
  try {
    return toJSON(source);
  } catch (error) {
    return asError(error);
  }
}

export function toSourceCode(
  uri: string,
  source: string,
  version?: number,
): LiquidSourceCode | JSONSourceCode {
  const isLiquid = uri.endsWith('.liquid');

  if (isLiquid) {
    return {
      uri: path.normalize(uri),
      source,
      type: SourceCodeType.LiquidHtml,
      ast: toLiquidHTMLAST(source),
      version,
    };
  } else {
    return {
      uri: path.normalize(uri),
      source,
      type: SourceCodeType.JSON,
      ast: toJSONAST(source),
      version,
    };
  }
}
