import { RelativePath, UriString } from './types';
import { URI, Utils } from 'vscode-uri';

export { URI, Utils };

export function relative(uri: UriString | URI, rootUri: UriString): RelativePath {
  return normalize(uri)
    .replace(rootUri, '')
    .replace(/\\\\/g, '/') // We expect forward slash paths (windows path get normalized)
    .replace(/^\/+/, '');
}

export function join(rootUri: UriString | URI, ...paths: string[]): string {
  return normalize(Utils.joinPath(asUri(rootUri), ...paths));
}

export function resolve(uri: UriString | URI, path: string): string {
  return normalize(Utils.resolvePath(asUri(uri), path));
}

export function normalize(uri: UriString | URI): UriString {
  const normalized = asUri(uri).toString(true);
  // On Windows machines, paths use backslash ('\') as separator
  // This causes issues since backslashes in glob patterns are treated as escape characters
  // and in various URI contexts, forward slashes are expected
  // We replace all backslashes with forward slashes for cross-platform consistency
  return normalized.replace(/\\/g, '/');
}

export function dirname(uri: UriString | URI): UriString {
  return normalize(Utils.dirname(asUri(uri)));
}

export function basename(uri: UriString | URI, ext?: string): string {
  const base = Utils.basename(asUri(uri));
  return ext ? base.replace(new RegExp(`${ext.replace(/\./g, '\\.')}$`), '') : base;
}

export function fsPath(uri: UriString | URI): string {
  return asUri(uri).fsPath;
}

function asUri(uri: UriString | URI): URI {
  return URI.isUri(uri) ? uri : URI.parse(uri);
}
