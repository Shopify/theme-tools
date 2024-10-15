import { RelativePath, Uri } from './types';
import { URI, Utils } from 'vscode-uri';

export function relative(uri: Uri, rootUri: Uri): RelativePath {
  return uri.replace(rootUri, '').replace(/^\/+/, '');
}

export function join(rootUri: Uri, ...paths: string[]): string {
  const root = URI.parse(rootUri);
  return Utils.joinPath(root, ...paths).toString();
}

export function normalize(uri: Uri): Uri {
  return URI.parse(uri).toString();
}

export function dirname(uri: Uri): Uri {
  return Utils.dirname(URI.parse(uri)).toString();
}

export function fsPath(uri: Uri): string {
  return URI.parse(uri).fsPath;
}
