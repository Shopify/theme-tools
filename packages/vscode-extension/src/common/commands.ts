import { path } from '@shopify/theme-check-common';
import {
  AugmentedLocation,
  ThemeGraphDeadCodeRequest,
  ThemeGraphRootRequest,
} from '@shopify/theme-language-server-common';
import { commands, Position, Range, Uri, window, workspace } from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';

export function openLocation(ref: AugmentedLocation) {
  if (ref.exists === false || !ref.position) {
    commands.executeCommand('vscode.open', Uri.parse(ref.uri));
    return;
  }

  workspace.openTextDocument(Uri.parse(ref.uri)).then((doc) => {
    window.showTextDocument(doc, {
      selection: new Range(
        new Position(ref.position.start.line, ref.position.start.character),
        new Position(ref.position.end.line, ref.position.end.character),
      ),
      preserveFocus: true,
      preview: true,
    });
  });
}

/**
 * Fetches the theme root and the list of dead (orphaned) files for a given uri.
 * The uri only needs to belong to the theme — the server resolves the root and
 * computes dead code across the whole theme graph.
 */
export async function fetchDeadCode(
  client: BaseLanguageClient,
  uri: string,
): Promise<{ rootUri: string; deadCode: string[] }> {
  const [rootUri, deadCode] = await Promise.all([
    client.sendRequest(ThemeGraphRootRequest.type, { uri }),
    client.sendRequest(ThemeGraphDeadCodeRequest.type, { uri }),
  ]);
  return { rootUri, deadCode };
}

/**
 * Presents the dead files as a multi-select quick pick and opens whatever the
 * user selects. Does not depend on the active editor, so it can be driven from
 * a startup check as well as the command.
 */
export async function showDeadCodePicker(rootUri: string, deadCode: string[]): Promise<void> {
  const relativePaths = deadCode.map((file) => path.relative(file, rootUri));
  const selectedFiles = await window.showQuickPick(relativePaths, {
    canPickMany: true,
    placeHolder: 'Select files to open',
  });
  if (selectedFiles) {
    selectedFiles.forEach((file) => {
      const uri = path.join(rootUri, file);
      workspace.openTextDocument(Uri.parse(uri)).then((doc) => {
        window.showTextDocument(doc, { preview: false, preserveFocus: true, viewColumn: 2 });
      });
    });
  }
}

export function makeDeadCode(client: BaseLanguageClient) {
  return async function deadCode() {
    const uri = window.activeTextEditor?.document.uri.toString();
    if (!uri) return;
    const { rootUri, deadCode } = await fetchDeadCode(client, uri);

    if (deadCode.length === 0) {
      window.showInformationMessage('No dead code found.');
    } else {
      await showDeadCodePicker(rootUri, deadCode);
    }
  };
}
