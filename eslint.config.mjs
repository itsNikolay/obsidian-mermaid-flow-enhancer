import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['main.js', 'docs/demo/demo.js', 'docs/assets/**', 'artifacts/**',
    'node_modules/**', 'demo-vault/**', 'test-results/**', 'playwright-report/**'] },
  { files: ['**/*.js', '**/*.mjs'], extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 'latest', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] } },
  { files: ['tests/**/*.js'], languageOptions: { sourceType: 'commonjs', globals: {
    ...globals.node, ...globals.browser, mermaid: 'readonly', MPELayout: 'readonly',
    MPEHighlight: 'readonly', mpeController: 'readonly',
  } } },
  { files: ['**/*.ts', '**/*.mts'], extends: [tseslint.configs.recommended],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    } },
  { files: ['src/**/*.ts'], rules: {
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/unbound-method': 'error',
  } },
  { files: ['**/*.{js,mjs,ts,mts}'], linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { eqeqeq: ['error', 'always', { null: 'ignore' }], 'prefer-const': 'error',
      'no-var': 'error', 'no-throw-literal': 'error' } },
);
