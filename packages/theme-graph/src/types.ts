import { UriString } from '@shopify/theme-check-common';
import { Program, Script, Module } from '@swc/core';

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
  ast: Program | Script | Module | Error;
}
