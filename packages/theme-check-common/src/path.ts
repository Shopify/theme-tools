import { RelativePath, UriString } from './types';
import { URI, Utils } from 'vscode-uri';

export function relative(uri: UriString, rootUri: UriString): RelativePath {
  return uri
    .replace(rootUri, '')
    .replace(/\\\\/g, '/') // We expect forward slash paths (windows path get normalized)
    .replace(/^\/+/, '');
}

export function join(rootUri: UriString, ...paths: string[]): string {
  const root = URI.parse(rootUri);
  return normalize(Utils.joinPath(root, ...paths));
}

export function normalize(uri: UriString | URI): UriString {
  if (!URI.isUri(uri)) {
    uri = URI.parse(uri);
  }
  return uri.toString(true);
}

export function dirname(uri: UriString): UriString {
  return normalize(Utils.dirname(URI.parse(uri)));
}

export function basename(uri: UriString, ext?: string): string {
  return URI.parse(uri)
    .path.split(/(\\|\/)/g)
    .pop()!
    .replace(ext ? new RegExp(`${ext}$`) : '', '');
}

export function fsPath(uri: UriString): string {
  return URI.parse(uri).fsPath;
}
