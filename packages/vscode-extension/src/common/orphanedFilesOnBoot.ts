import { path } from '@shopify/theme-check-common';
import {
  ThemeGraphDeadCodeRequest,
  ThemeGraphRootRequest,
} from '@shopify/theme-language-server-common';
import { window, workspace, ConfigurationTarget, Uri } from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { showDeadCodePicker } from './commands';

export const CHECK_ORPHANED_ON_BOOT_SETTING = 'themeCheck.checkOrphanedFilesOnBoot';
const PRELOAD_ON_BOOT_SETTING = 'themeCheck.preloadOnBoot';

const REVIEW = 'Review';
const DONT_SHOW_AGAIN = "Don't show again";

/**
 * Glob for any file that signals a theme root, mirroring `findRoot`'s notion of a
 * root: a `.theme-check.yml`, a `shopify.extension.toml` (theme app extensions),
 * or a `snippets` directory (configless themes / zipped themes / TAEs). Each match
 * is just an anchor inside a theme — the server resolves it to the actual root.
 */
const ROOT_ANCHOR_GLOB = '**/{.theme-check.yml,shopify.extension.toml,snippets/*}';

/**
 * On extension startup, surface orphaned (dead) files with a dismissable
 * notification instead of requiring the user to run the dead-code command. Gated
 * by the `themeCheck.checkOrphanedFilesOnBoot` setting, and off when
 * `themeCheck.preloadOnBoot` is false because finding dead code builds the theme
 * graph that setting turns off.
 *
 * A workspace can contain more than one theme, so this prompts once per theme root
 * that has orphaned files — each notification's count matches the files its own
 * "Review" picker opens (no cross-theme aggregation).
 */
export async function checkOrphanedFilesOnBoot(client: BaseLanguageClient): Promise<void> {
  const config = workspace.getConfiguration();
  if (!config.get(PRELOAD_ON_BOOT_SETTING, true)) return;
  if (!config.get(CHECK_ORPHANED_ON_BOOT_SETTING, true)) return;

  const anchors = await workspace.findFiles(ROOT_ANCHOR_GLOB, '**/node_modules/**');
  const roots = await themeRoots(client, anchors);

  for (const [rootUri, anchor] of roots) {
    const deadCode = await client.sendRequest(ThemeGraphDeadCodeRequest.type, { uri: anchor });
    if (deadCode.length === 0) continue;

    const shouldStop = await promptForRoot(rootUri, deadCode);
    if (shouldStop) return;
  }
}

/**
 * Resolves the anchors to their theme roots, keeping one anchor per root.
 *
 * The glob matches every snippet, so anchors in the same directory are collapsed
 * first: they share a root, and a theme with hundreds of snippets should cost one
 * root lookup, not hundreds.
 */
async function themeRoots(client: BaseLanguageClient, anchors: Uri[]) {
  const anchorByDirectory = new Map<string, string>();
  for (const anchor of anchors) {
    const uri = anchor.toString();
    const directory = path.dirname(uri);
    if (!anchorByDirectory.has(directory)) anchorByDirectory.set(directory, uri);
  }

  const anchorByRoot = new Map<string, string>();
  for (const anchor of anchorByDirectory.values()) {
    const rootUri = await client.sendRequest(ThemeGraphRootRequest.type, { uri: anchor });
    if (rootUri && !anchorByRoot.has(rootUri)) anchorByRoot.set(rootUri, anchor);
  }

  return anchorByRoot;
}

/**
 * Shows the notification for a single theme root. Returns `true` if the user opted
 * out ("Don't show again"), so the caller can stop prompting the remaining roots.
 */
async function promptForRoot(rootUri: string, deadCode: string[]): Promise<boolean> {
  const count = deadCode.length;
  const choice = await window.showInformationMessage(
    `Found ${count} orphaned file${count === 1 ? '' : 's'} in your theme.`,
    REVIEW,
    DONT_SHOW_AGAIN,
  );

  if (choice === REVIEW) {
    await showDeadCodePicker(rootUri, deadCode);
  } else if (choice === DONT_SHOW_AGAIN) {
    await workspace
      .getConfiguration()
      .update(CHECK_ORPHANED_ON_BOOT_SETTING, false, ConfigurationTarget.Global);
    return true;
  }

  return false;
}
