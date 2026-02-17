import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Browser Extension Activation', () => {
  const consoleErrors: string[] = [];
  const originalError = console.error;

  suiteSetup(() => {
    // Capture console.error calls to detect "require is not defined" etc.
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(' '));
      originalError.apply(console, args);
    };
  });

  suiteTeardown(() => {
    console.error = originalError;
  });

  test('Extension activates without errors', async () => {
    const ext = vscode.extensions.getExtension('Shopify.theme-check-vscode');
    assert.ok(ext, 'Extension should be present');

    await ext.activate();
    assert.strictEqual(ext.isActive, true, 'Extension should be active');
  });

  test('No console errors during activation', () => {
    const criticalErrors = consoleErrors.filter(
      (e) => e.includes('require is not defined') || e.includes('Cannot find module'),
    );
    assert.strictEqual(
      criticalErrors.length,
      0,
      `Critical errors found: ${criticalErrors.join('; ')}`,
    );
  });

  test('Autocomplete suggests "product" for Liquid objects', async function () {
    this.timeout(30000); // LSP may take time to initialize

    // 1. Get workspace file URI
    const wsFolder = vscode.workspace.workspaceFolders![0].uri;
    const fileUri = vscode.Uri.joinPath(wsFolder, 'layout', 'theme.liquid');

    // 2. Open and show document
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(doc);

    // 3. Insert text at beginning
    const position = new vscode.Position(0, 0);
    await editor.edit((editBuilder) => {
      editBuilder.insert(position, '{{ prod');
    });

    // 4. Wait for LSP to be ready (may need small delay)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 5. Trigger completions at cursor (after "{{ prod")
    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      doc.uri,
      new vscode.Position(0, 7), // position after "{{ prod"
    );

    // 6. Assert "product" is in suggestions
    const labels = completions!.items.map((item) =>
      typeof item.label === 'string' ? item.label : item.label.label,
    );
    assert.ok(
      labels.includes('product'),
      `Expected "product" in completions, got: ${labels.slice(0, 10).join(', ')}`,
    );
  });
});
