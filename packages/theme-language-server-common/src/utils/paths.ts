import { URI } from 'vscode-uri';

export type AbsolutePath = string;
export type RelativePath = string;
export type Protocol = 'browser' | 'file';

export function toAbsolutePath(uriString: string): AbsolutePath {
  const uri = URI.parse(uriString);
  return uri.path;
}
