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

  // @shopify/eslint-plugin requires prettier 3+!
  // we can manually disable problematic rules instead.
  {
    rules: {
      '@shopify/class-property-semi': 'off',
      '@shopify/binary-assignment-parens': 'off',
      'prefer-arrow-callback': 'off',
      'arrow-body-style': 'off',
    },
  },

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
    // if we want to *enforce* rather than relax any ts-eslint rules, the config
    // block's `files` needs to be a subset of the upstream `files` scope for
    // which the ts-eslint plugin is defined. otherwise eslint will crash :(
    // https://github.com/Shopify/web-configs/blob/main/packages/eslint-plugin/lib/config/typescript.js
    // one of several spooky-action-at-a-distance footguns of the new flat config!
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-shadow': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
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
