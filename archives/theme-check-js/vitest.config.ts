/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    singleThread: true,
    setupFiles: [
      './packages/common/src/test/test-setup.ts',
    ]
    // ...
  },
})
