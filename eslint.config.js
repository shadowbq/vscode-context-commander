// @ts-check
'use strict';

const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  // Global ignores
  {
    ignores: ['out/**', 'node_modules/**', 'media/**'],
  },

  // Disable eslint core rules superseded by @typescript-eslint
  tsPlugin.configs['flat/eslint-recommended'],

  // @typescript-eslint recommended rules + parser setup for .ts files
  ...tsPlugin.configs['flat/recommended'],

  // Project-specific overrides
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      curly: 'warn',
      eqeqeq: ['warn', 'always'],
      'no-throw-literal': 'warn',
      semi: ['warn', 'always'],
    },
  },
];
