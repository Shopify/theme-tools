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
yarn test:web

# Build test bundle only
yarn build:test
```

## Watch mode

```
# terminal 1
yarn build:test:watch

# terminal 2 (refresh for changes, no hmr)
yarn test:web:watch
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

### Node Tests (Future)

Reserved for Node-based e2e tests (e.g., testing CLI integration, file system operations).
