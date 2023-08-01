module.exports = {
  root: true,
  extends: ['eslint:recommended', 'eslint-config-prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/naming-convention': 'warn',
    '@typescript-eslint/semi': 'warn',
    'no-throw-literal': 'warn',
    curly: 'warn',
    eqeqeq: 'warn',
    semi: 'off',
  },
  env: {
    'node': true,
  },
  ignorePatterns: ['out', 'dist', '**/*.d.ts'],
};
