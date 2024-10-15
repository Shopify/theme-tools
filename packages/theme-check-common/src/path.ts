import { RelativePath, Uri } from './types';
import { URI, Utils } from 'vscode-uri';

export function relative(uri: Uri, rootUri: Uri): RelativePath {
  return uri
    .replace(rootUri, '')
    .replace(/\\\\/g, '/') // We expect forward slash paths (windows path get normalized)
    .replace(/^\/+/, '');
}

export function join(rootUri: Uri, ...paths: string[]): string {
  const root = URI.parse(rootUri);
  return normalize(Utils.joinPath(root, ...paths));
}

export function normalize(uri: Uri | URI): Uri {
  if (!URI.isUri(uri)) {
    uri = URI.parse(uri);
  }
  return uri.toString(true);
}

export function dirname(uri: Uri): Uri {
  return normalize(Utils.dirname(URI.parse(uri)));
}

export function fsPath(uri: Uri): string {
  return URI.parse(uri).fsPath;
}
