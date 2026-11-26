# VS Code Extension Tests

This directory contains end-to-end tests that run in real VS Code environments.

## Structure

```
test/
  browser/     # Browser e2e tests (via @vscode/test-web)
    suite/     # Mocha test files
  node/        # Node e2e tests (future)
  tsconfig.json
```

## Why E2E Tests Live Here (Not in `src/`)

Unit tests in this repo are colocated with source code (`src/**/*.spec.ts`) and run with Vitest.

E2E tests are fundamentally different:
- **Runtime**: Real VS Code (browser or Node), not Vitest
- **Framework**: Mocha (required by `@vscode/test-web`), not Vitest
- **Build**: Webpack bundles tests separately from production code
- **Discovery**: Must NOT be discovered by Vitest

Separating e2e tests into `test/` ensures:
1. Vitest never discovers them (no module resolution errors)
2. Webpack can use a dedicated test config
3. Clear boundary between unit and integration testing

## Running Tests

```bash
# Browser e2e tests
pnpm test:web

# Build test bundle only
pnpm build:test
```

## Watch mode

```
# terminal 1
pnpm build:test:watch

# terminal 2 (refresh for changes, no hmr)
pnpm test:web:watch
```

## Adding Tests

### Browser Tests

Add files to `test/browser/suite/` with `.test.ts` suffix:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('My Feature', () => {
  test('does something', async () => {
    // Test code here
  });
});
```

Tests are auto-discovered via webpack's `require.context`.

`languageFeatures.test.ts` drives the language server the way an editor does: diagnostics, hover, document links, on-type formatting, rename and document formatting. Its fixtures are written into the test workspace with `workspace.fs`, which keeps them in memory.

The language server runs in its own web worker, whose console the tests can't see. `startMonitoredLanguageServer` (`languageServerWorker.ts`) restarts the server in a worker that reports its `console.error` calls, uncaught errors and error responses, and the suite fails if there are any.

To run against the VS Code version an embedder ships, pin its commit: `vscode-test-web --quality=stable --commit=<sha>`.

### Node Tests (Future)

Reserved for Node-based e2e tests (e.g., testing CLI integration, file system operations).
