import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  server: {
    fs: { allow: [repoRoot] },
  },
  test: {
    include: ['src/test/browser/differential.test.ts', 'src/rust-parity/canonical.test.ts'],
    setupFiles: ['./rust/register.mjs'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
