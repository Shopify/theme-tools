import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation', () => {
  const originalError = console.error;
  const errors: string[] = [];

  suiteSetup(() => {
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
      originalError.apply(console, args);
    };
  });

  suiteTeardown(() => {
    console.error = originalError;
  });

  test('extension should activate without errors', async () => {
    const ext = vscode.extensions.getExtension('shopify.theme-check-vscode');
    assert.ok(ext, 'Extension should be found');

    await ext.activate();
    assert.strictEqual(ext.isActive, true, 'Extension should be active');

    // Filter for critical errors (like "require is not defined")
    const criticalErrors = errors.filter(
      (e) => e.includes('require is not defined') || e.includes('ReferenceError'),
    );
    assert.strictEqual(criticalErrors.length, 0, `No critical errors expected, got: ${criticalErrors.join(', ')}`);
  });
});
