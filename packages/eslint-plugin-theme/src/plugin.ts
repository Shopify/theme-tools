import type { ESLint, Linter } from 'eslint';
import { version } from '../package.json';
import { rules } from './rules';

export interface ThemeEslintPlugin extends ESLint.Plugin {
  meta: {
    name: string;
    version: string;
  };
  rules: typeof rules;
  configs: {
    recommended: Linter.Config;
  };
}

const plugin: ThemeEslintPlugin = {
  meta: {
    name: '@shopify/eslint-plugin-theme',
    version,
  },
  rules,
  configs: {} as ThemeEslintPlugin['configs'],
};

plugin.configs.recommended = {
  name: 'theme/recommended',
  plugins: {
    theme: plugin,
  },
  rules: {
    'theme/no-stale-element-after-await': 'warn',
    'theme/no-stored-outside-element': 'warn',
    'theme/require-guarded-custom-element-define': 'warn',
    'theme/require-listener-cleanup': 'warn',
    'theme/require-page-state-cleanup': 'warn',
    'theme/require-teardown': 'warn',
  },
};

export default plugin;
