import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import toJSON from 'json-to-ast';

import { SourceCodeType, JSONSourceCode, LiquidSourceCode } from './types';
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
  absolutePath: string,
  source: string,
  version?: number,
): LiquidSourceCode | JSONSourceCode {
  const isLiquid = absolutePath.endsWith('.liquid');

  if (isLiquid) {
    return {
      absolutePath: normalize(absolutePath),
      source,
      type: SourceCodeType.LiquidHtml,
      ast: toLiquidHTMLAST(source),
      version,
    };
  } else {
    return {
      absolutePath: normalize(absolutePath),
      source,
      type: SourceCodeType.JSON,
      ast: toJSONAST(source),
      version,
    };
  }
}

type MaybeWindowsPath = string;

function normalize(path: MaybeWindowsPath): string {
  return path.replace(/\\/g, '/');
}
