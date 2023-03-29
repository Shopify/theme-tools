import { URI } from 'vscode-languageserver';

export type AbsolutePath = string;
export type RelativePath = string;
export type Protocol = 'browser' | 'file';

export function toAbsolutePath(uri: URI): AbsolutePath {
  // TODO
  return uri.replace(/^\w+:(\/\/)?/, '');
}
