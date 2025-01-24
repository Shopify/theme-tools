import { Uri, workspace } from 'vscode';
import * as path from 'node:path';

/**
 * Checks if this VS Code extension is running within Cursor editor environment.
 *
 * @param processInstance - Most of use cases should rely on the default process
 *                          instance. The processInstance param exists primarily
 *                          to support unit testing.
 *
 * @returns `true` if extension is running in Cursor environment
 */
export function isCursor(processInstance: typeof process = process): boolean {
  try {
    return isElectronCursor(processInstance) || hasCursorEnv(processInstance);
  } catch {
    return false;
  }
}

function hasCursorEnv(processInstance: typeof process) {
  // Check for Cursor-specific environment variables that are set by Cursor itself
  return (
    processInstance.env.CURSOR_CHANNEL !== undefined ||
    processInstance.env.CURSOR_VERSION !== undefined
  );
}

function isElectronCursor(processInstance: typeof process) {
  // Check if we're running in Cursor's electron process
  const processTitle = processInstance.title.toLowerCase();
  return processTitle.includes('cursor') && processInstance.versions.electron !== undefined;
}
/**
 * Checks if any of the open workspace folders contains a Shopify theme project.
 *
 * A Shopify theme project is identified by the presence of required theme
 * folders: `templates`, `config`, `layout`, and `sections`.
 *
 * @returns Promise that resolves to `true` if a Shopify theme is detected.
 */
export async function hasShopifyThemeLoaded(): Promise<boolean> {
  const workspaceFolders = workspace.workspaceFolders ?? [];

  const results = await Promise.all(
    workspaceFolders.map((folder) => isShopifyThemeFolder(folder.uri.fsPath)),
  );

  return results.some((result) => result);
}

async function isShopifyThemeFolder(folderPath: string): Promise<boolean> {
  try {
    const themeFolders = ['templates', 'config', 'layout', 'sections'];

    await Promise.all(
      themeFolders
        .map((folder) => Uri.file(path.join(folderPath, folder)))
        .map((uri) => workspace.fs.stat(uri)),
    );

    return true;
  } catch {
    return false;
  }
}
