import { toLiquidHtmlAST } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import toJSON from 'json-to-ast';

import { SourceCodeType, JSONSourceCode, LiquidSourceCode } from './types';

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  } else if (typeof error === 'string') {
    return new Error(error);
  } else if (error && typeof error.toString === 'function') {
    return new Error(error.toString());
  } else {
    return new Error('An unknown error occurred');
  }
}

function parseLiquid(source: string) {
  try {
    return toLiquidHtmlAST(source);
  } catch (error) {
    return asError(error);
  }
}

function parseJSON(source: string) {
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
): LiquidSourceCode | JSONSourceCode | undefined {
  const isLiquid = absolutePath.endsWith('.liquid');

  if (isLiquid) {
    return {
      absolutePath,
      source,
      type: SourceCodeType.LiquidHtml,
      ast: parseLiquid(source),
      version,
    };
  } else {
    return {
      absolutePath,
      source,
      type: SourceCodeType.JSON,
      ast: parseJSON(source),
      version,
    };
  }
}
