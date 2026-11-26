import * as assert from 'assert';
import * as vscode from 'vscode';
import { LANGUAGE_SERVER_TIMEOUT_MS, waitFor } from './helpers';

// The extension activates before the tests load, so errors during activation
// can't be observed here. languageFeatures.test.ts restarts the language server
// and fails on the errors that the extension host and the server log.
suite('Browser Extension Activation', () => {
  test('Extension activates without errors', async () => {
    const ext = vscode.extensions.getExtension('Shopify.theme-check-vscode');
    assert.ok(ext, 'Extension should be present');

    await ext.activate();
    assert.strictEqual(ext.isActive, true, 'Extension should be active');
  });

  test('Autocomplete suggests "product" for Liquid objects', async function () {
    this.timeout(2 * LANGUAGE_SERVER_TIMEOUT_MS); // LSP may take time to initialize

    // 1. Get workspace file URI
    const wsFolder = vscode.workspace.workspaceFolders![0].uri;
    const fileUri = vscode.Uri.joinPath(wsFolder, 'layout', 'theme.liquid');

    // 2. Open and show document
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(doc);

    // 3. Insert text at beginning. Close the output: an unclosed `{{` runs to
    // the next `}}` in the file, where the language server offers nothing.
    const position = new vscode.Position(0, 0);
    await editor.edit((editBuilder) => {
      editBuilder.insert(position, '{{ prod }}');
    });

    // 4. Ask for completions until the language server answers. VS Code also
    // suggests the words of the document, and "product" is one of them, so only
    // a Variable completion shows that the language server answered.
    await waitFor(
      'the language server to complete "product"',
      async () => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          doc.uri,
          new vscode.Position(0, 7), // position after "{{ prod"
        );
        return completions.items
          .filter((item) => completionLabel(item) === 'product')
          .map((item) => ({ label: completionLabel(item), kind: item.kind }));
      },
      (products) => products.some((item) => item.kind === vscode.CompletionItemKind.Variable),
    );
  });
});

function completionLabel(item: vscode.CompletionItem) {
  return typeof item.label === 'string' ? item.label : item.label.label;
}
