import { workspace } from 'vscode';
import * as path from 'node:path';
import { fileExists } from './fs';

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
  const themeRootDirs = await getShopifyThemeRootDirs();
  return themeRootDirs.length > 0;
}

/**
 * Gets the root directory paths of all Shopify themes in the workspace.
 *
 * Iterates through workspace folders and checks each one to determine if it
 * contains a valid Shopify theme structure by verifying the presence of
 * required theme folders.
 *
 * @returns Promise that resolves to an array of absolute paths to Shopify theme
 *          root directories. Returns an empty array if no Shopify themes are
 *          found.
 */
export async function getShopifyThemeRootDirs(): Promise<string[]> {
  const workspaceFolders = workspace.workspaceFolders ?? [];

  const folders = await Promise.all(
    workspaceFolders
      .map((folder) => folder.uri.fsPath)
      .map(async (folderPath) => {
        if (await isShopifyThemeFolder(folderPath)) {
          return folderPath;
        }
      }),
  );

  return folders.filter((folder): folder is string => !!folder);
}
async function isShopifyThemeFolder(root: string): Promise<boolean> {
  try {
    const themeFolders = ['templates', 'config', 'layout', 'sections'];

    const results = await Promise.all(
      themeFolders.map((folder) => fileExists(path.join(root, folder))),
    );

    return results.every(Boolean);
  } catch {
    return false;
  }
}
