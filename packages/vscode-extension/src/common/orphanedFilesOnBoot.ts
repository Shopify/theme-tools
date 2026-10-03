import { window, workspace, ConfigurationTarget } from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { fetchDeadCode, showDeadCodePicker } from './commands';

export const CHECK_ORPHANED_ON_BOOT_SETTING = 'themeCheck.checkOrphanedFilesOnBoot';

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
 * by the `themeCheck.checkOrphanedFilesOnBoot` setting.
 *
 * A workspace can contain more than one theme, so this prompts once per theme root
 * that has orphaned files — each notification's count matches the files its own
 * "Review" picker opens (no cross-theme aggregation).
 */
export async function checkOrphanedFilesOnBoot(client: BaseLanguageClient): Promise<void> {
  const enabled = workspace.getConfiguration().get(CHECK_ORPHANED_ON_BOOT_SETTING, true);
  if (!enabled) return;

  const anchors = await workspace.findFiles(ROOT_ANCHOR_GLOB, '**/node_modules/**');

  // Resolve each anchor to its theme root + dead code, then dedupe by root so a
  // theme matched by several anchors is only prompted once.
  const byRoot = new Map<string, string[]>();
  for (const anchor of anchors) {
    const { rootUri, deadCode } = await fetchDeadCode(client, anchor.toString());
    if (rootUri && deadCode.length > 0 && !byRoot.has(rootUri)) {
      byRoot.set(rootUri, deadCode);
    }
  }

  for (const [rootUri, deadCode] of byRoot) {
    const shouldStop = await promptForRoot(rootUri, deadCode);
    if (shouldStop) return;
  }
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
