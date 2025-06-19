import { asError, toSourceCode as tcToSourceCode, UriString } from '@shopify/theme-check-common';
import { parse as acornParse, Program } from 'acorn';
import {
  CssSourceCode,
  FileSourceCode,
  ImageSourceCode,
  JsSourceCode,
  SUPPORTED_ASSET_IMAGE_EXTENSIONS,
  SvgSourceCode,
} from './types';
import { extname } from './utils';

export async function toCssSourceCode(uri: UriString, source: string): Promise<CssSourceCode> {
  return {
    type: 'css',
    uri,
    source,
    ast: new Error('File parsing not implemented yet'), // Placeholder for CSS parsing
  };
}

export async function toSvgSourceCode(uri: UriString, source: string): Promise<SvgSourceCode> {
  return {
    type: 'svg',
    uri,
    source,
    ast: new Error('File parsing not implemented yet'), // Placeholder for SVG parsing
  };
}

async function toImageSourceCode(uri: UriString, source: string): Promise<ImageSourceCode> {
  return {
    type: 'image',
    uri,
    source,
    ast: new Error('Image files are not parsed'),
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

export async function toSourceCode(uri: UriString, source: string): Promise<FileSourceCode> {
  const extension = extname(uri);

  if (extension === 'json' || extension === 'liquid') {
    return tcToSourceCode(uri, source);
  } else if (extension === 'js') {
    return toJsSourceCode(uri, source);
  } else if (extension === 'css') {
    return toCssSourceCode(uri, source);
  } else if (extension === 'svg') {
    return toCssSourceCode(uri, source);
  } else if (SUPPORTED_ASSET_IMAGE_EXTENSIONS.includes(extension)) {
    return toImageSourceCode(uri, source);
  } else {
    throw new Error(`Unknown source code type for ${uri}`);
  }
}
