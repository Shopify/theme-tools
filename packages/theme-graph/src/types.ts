import { UriString } from '@shopify/theme-check-common';
import { Program } from 'acorn';

export interface CssSourceCode {
  type: 'css';
  uri: UriString;
  source: string;
  ast: any | Error;
}
export interface JsSourceCode {
  type: 'javascript';
  uri: UriString;
  source: string;
  ast: Program | Error;
}
