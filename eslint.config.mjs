import path from 'node:path';
import { fileURLToPath } from 'node:url';

import shopifyEslintPlugin from '@shopify/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import { includeIgnoreFile } from '@eslint/compat';

// https://eslint.org/docs/latest/use/configure/ignore#including-gitignore-files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

const config = [
  ...shopifyEslintPlugin.configs.typescript,
  ...shopifyEslintPlugin.configs['typescript-type-checking'],
  ...shopifyEslintPlugin.configs.node,
  includeIgnoreFile(gitignorePath),
  {
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/naming-convention': 'off',
      // use the upstream config, but relax reporting newlines for now
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
          'newlines-between': 'ignore',
        },
      ],
      'import/no-cycle': 'off',
      'import/no-extraneous-dependencies': 'off',
      'id-length': 'off',
      curly: ['error', 'multi-line', 'consistent'],
    },
  },
  {
    files: ['**/*.spec.ts'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },
];

export default config;
