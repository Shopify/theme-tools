import {
  asError,
  JSONSourceCode,
  LiquidSourceCode,
  toSourceCode as tcToSourceCode,
  UriString,
} from '@shopify/theme-check-common';
import { parse as acornParse, Program } from 'acorn';
import { CssSourceCode, JsSourceCode } from './types';

export async function toCssSourceCode(uri: UriString, source: string): Promise<CssSourceCode> {
  return {
    type: 'css',
    uri,
    source,
    ast: new Error('CSS parsing not implemented yet'), // Placeholder for CSS parsing
  };
}

export async function toJsSourceCode(uri: UriString, source: string): Promise<JsSourceCode> {
  return {
    type: 'javascript',
    uri,
    source,
    ast: parseJs(source),
  };
}

export function parseJs(source: string): Program | Error {
  try {
    return acornParse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
  } catch (error) {
    return asError(error);
  }
}

export async function toSourceCode(
  uri: UriString,
  source: string,
): Promise<JSONSourceCode | LiquidSourceCode | JsSourceCode | CssSourceCode> {
  if (uri.endsWith('.json') || uri.endsWith('.liquid')) {
    return tcToSourceCode(uri, source);
  } else if (uri.endsWith('.js')) {
    return toJsSourceCode(uri, source);
  } else if (uri.endsWith('.css')) {
    return toCssSourceCode(uri, source);
  } else {
    throw new Error(`Unknown source code type for ${uri}`);
  }
}
