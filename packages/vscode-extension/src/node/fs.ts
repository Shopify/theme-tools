import { Uri, workspace } from 'vscode';

export async function fileExists(path: string): Promise<boolean> {
  try {
    await workspace.fs.stat(Uri.file(path));
    return true;
  } catch (e) {
    return false;
  }
}
