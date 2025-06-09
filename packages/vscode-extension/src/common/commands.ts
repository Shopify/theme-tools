import { path } from '@shopify/theme-check-common';
import { AugmentedLocation } from '@shopify/theme-language-server-common';
import { Position, Range, Uri, window, workspace } from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';

export function openLocation(ref: AugmentedLocation) {
  workspace.openTextDocument(Uri.parse(ref.uri)).then((doc) => {
    window.showTextDocument(doc, {
      selection: ref.position
        ? new Range(
            new Position(ref.position.start.line, ref.position.start.character),
            new Position(ref.position.end.line, ref.position.end.character),
          )
        : undefined,
      preserveFocus: true,
      preview: true,
    });
  });
}

export function makeDeadCode(client: BaseLanguageClient) {
  return async function deadCode() {
    const uri = window.activeTextEditor?.document.uri.toString();
    if (!uri) return;
    const [rootUri, deadCode] = await Promise.all([
      client.sendRequest<string>('themeGraph/rootUri', { uri }),
      client.sendRequest<string[]>('themeGraph/deadCode', { uri }),
    ]);

    if (deadCode.length === 0) {
      window.showInformationMessage('No dead code found.');
    } else {
      const relativePaths = deadCode.map((file) => path.relative(file, rootUri));
      const selectedFiles = await window.showQuickPick(relativePaths, {
        canPickMany: true,
        placeHolder: 'Select files to open',
      });
      if (selectedFiles) {
        selectedFiles.forEach((file) => {
          const uri = path.join(rootUri, file);
          workspace.openTextDocument(uri).then((doc) => {
            window.showTextDocument(doc, { preview: false });
          });
        });
      }
    }
  };
}
