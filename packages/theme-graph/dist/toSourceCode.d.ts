import { UriString } from '@shopify/theme-check-common';
import { Program } from 'acorn';
import { CssSourceCode, FileSourceCode, JsSourceCode, SvgSourceCode } from './types';
export declare function toCssSourceCode(uri: UriString, source: string): Promise<CssSourceCode>;
export declare function toSvgSourceCode(uri: UriString, source: string): Promise<SvgSourceCode>;
export declare function toJsSourceCode(uri: UriString, source: string): Promise<JsSourceCode>;
export declare function parseJs(source: string): Program | Error;
export declare function toSourceCode(uri: UriString, source: string): Promise<FileSourceCode>;
