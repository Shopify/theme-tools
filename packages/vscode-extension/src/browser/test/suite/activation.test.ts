import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation', () => {
  const errors: string[] = [];
  const originalError = console.error;

  suiteSetup(() => {
    // Intercept console.error to catch "require is not defined" type errors
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
      originalError.apply(console, args);
    };
  });

  suiteTeardown(() => {
    console.error = originalError;
  });

  test('Extension should activate without errors', async () => {
    const extension = vscode.extensions.getExtension('Shopify.theme-check-vscode');
    assert.ok(extension, 'Extension should be present');

    await extension.activate();
    assert.ok(extension.isActive, 'Extension should be active');

    // Check no "require is not defined" or similar errors
    const criticalErrors = errors.filter(e =>
      e.includes('require is not defined') ||
      e.includes('is not a function') ||
      e.includes('Cannot read properties of undefined')
    );
    assert.strictEqual(criticalErrors.length, 0,
      `Critical errors detected: ${criticalErrors.join('; ')}`);
  });
});
