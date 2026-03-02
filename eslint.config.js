const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      'ios/**',
      'android/**',
      'e2e/**',
      'scripts/**',
      'firebase/functions/**',
      '*.config.js',
      '*.config.ts',
      '__mocks__/**',
      'assets/**',
      'content/**',
      'artifacts/**',
      'coverage/**',
    ],
  },
  // Main source rules
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        __DEV__: true,
        fetch: true,
        XMLHttpRequest: true,
        FormData: true,
        console: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        requestAnimationFrame: true,
        cancelAnimationFrame: true,
        btoa: true,
        atob: true,
        URL: true,
        Blob: true,
        process: true,
        require: true,
        module: true,
        performance: true,
        AbortController: true,
        AbortSignal: true,
        Headers: true,
        Request: true,
        Response: true,
        TextEncoder: true,
        TextDecoder: true,
        alert: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-no-comment-textnodes': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
  },
];
