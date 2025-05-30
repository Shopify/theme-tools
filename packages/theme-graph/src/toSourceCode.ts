import {
  asError,
  JSONSourceCode,
  LiquidSourceCode,
  toSourceCode as tcToSourceCode,
  UriString,
} from '@shopify/theme-check-common';
import { Module, parse as parseJS, Program, Script } from '@swc/core';
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
    ast: await parseJS(source, { syntax: 'ecmascript', script: true }),
  };
}

export async function parseJs(source: string): Promise<Program | Script | Module | Error> {
  try {
    return parseJS(source, { syntax: 'ecmascript' });
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
