/// <reference types="vitest" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "packages/prettier-plugin-liquid/**", // TODO: Set up testing for this package.
    ],
    singleThread: true,
    setupFiles: [
      "./packages/theme-check-common/src/test/test-setup.ts",
      "./packages/theme-language-server-common/src/test/test-setup.ts",
    ],
  },
});
