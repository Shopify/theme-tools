import { window, workspace, ConfigurationTarget } from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';
import { fetchDeadCode, showDeadCodePicker } from './commands';

export const CHECK_ORPHANED_ON_BOOT_SETTING = 'themeCheck.checkOrphanedFilesOnBoot';

const REVIEW = 'Review';
const DONT_SHOW_AGAIN = "Don't show again";

/**
 * On extension startup, surface orphaned (dead) files with a single dismissable
 * notification instead of requiring the user to run the dead-code command. Gated
 * by the `themeCheck.checkOrphanedFilesOnBoot` setting. Aggregates across every
 * theme root in the workspace; "Review" opens the picker for the first root that
 * has orphaned files.
 */
export async function checkOrphanedFilesOnBoot(client: BaseLanguageClient): Promise<void> {
  const enabled = workspace.getConfiguration().get(CHECK_ORPHANED_ON_BOOT_SETTING, true);
  if (!enabled) return;

  const configFiles = await workspace.findFiles('**/.theme-check.yml', '**/node_modules/**');

  let total = 0;
  let firstHit: { rootUri: string; deadCode: string[] } | undefined;
  for (const file of configFiles) {
    const { rootUri, deadCode } = await fetchDeadCode(client, file.toString());
    if (deadCode.length > 0) {
      total += deadCode.length;
      if (!firstHit) firstHit = { rootUri, deadCode };
    }
  }

  if (total === 0 || !firstHit) return;

  const choice = await window.showInformationMessage(
    `Found ${total} orphaned file${total === 1 ? '' : 's'} in your theme.`,
    REVIEW,
    DONT_SHOW_AGAIN,
  );

  if (choice === REVIEW) {
    await showDeadCodePicker(firstHit.rootUri, firstHit.deadCode);
  } else if (choice === DONT_SHOW_AGAIN) {
    await workspace
      .getConfiguration()
      .update(CHECK_ORPHANED_ON_BOOT_SETTING, false, ConfigurationTarget.Global);
  }
}
