import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['main.js', 'docs/demo/demo.js', 'docs/assets/**', 'artifacts/**',
    'node_modules/**', 'demo-vault/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { ecmaVersion: 'latest' },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { 'eqeqeq': ['error', 'always', { null: 'ignore' }], 'prefer-const': 'error',
      'no-var': 'error', 'no-throw-literal': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] } },
  { files: ['src/**/*.js', 'scripts/demo-entry.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.browser, ...globals.commonjs } } },
  { files: ['tests/**/*.js', 'playwright.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } } },
  { files: ['tests/integration/**/*.js'], languageOptions: { globals: {
    mermaid: 'readonly', MPELayout: 'readonly', MPEHighlight: 'readonly', mpeController: 'readonly',
  } } },
  { files: ['**/*.mjs'], languageOptions: { sourceType: 'module', globals: globals.node } },
  // These scripts execute callback bodies in Chromium/Obsidian via Playwright.
  { files: ['scripts/record-demo.mjs', 'scripts/test-obsidian-docker.mjs'],
    languageOptions: { globals: globals.browser } },
];
