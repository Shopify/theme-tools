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
    'theme/no-stored-outside-element': 'warn',
  },
};

export default plugin;
