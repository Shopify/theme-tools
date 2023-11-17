import { workspace } from 'vscode';

export function getConfig(path: string) {
  const [namespace, key] = path.split('.');
  return workspace.getConfiguration(namespace).get(key);
}
