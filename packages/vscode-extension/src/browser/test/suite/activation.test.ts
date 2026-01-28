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
});
