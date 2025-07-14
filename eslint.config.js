import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import vitest from 'eslint-plugin-vitest';

export default [
  // Base recommended configurations
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Main source files configuration (excluding test files)
  {
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts', 'src/test-setup.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      // TypeScript specific rules - more relaxed for this project
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // Allow any for API responses
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Can be strict with Node.js
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off', // Too strict for API integration
      '@typescript-eslint/no-unsafe-member-access': 'off', // Too strict for API responses
      '@typescript-eslint/no-unsafe-call': 'off', // Too strict for test mocking
      '@typescript-eslint/no-unsafe-return': 'off', // Too strict for API integration
      '@typescript-eslint/no-unsafe-argument': 'off', // Too strict for API integration
      '@typescript-eslint/require-await': 'off', // Some async methods are hooks
      '@typescript-eslint/no-misused-promises': 'off', // Allow promise handlers
      '@typescript-eslint/no-floating-promises': 'warn', // Warn but don't error
      '@typescript-eslint/restrict-template-expressions': 'off', // Allow flexible templates
      '@typescript-eslint/no-redundant-type-constituents': 'off', // Allow union flexibility
      '@typescript-eslint/no-base-to-string': 'off', // Allow object stringification

      // General code quality
      'no-console': 'off', // Allow console for logging in Node.js
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',

      // Semicolons and formatting
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'always-multiline'],
    },
  },

  // Test files configuration - very relaxed
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts', 'src/test-setup.ts'],
    plugins: {
      vitest,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'off', // Allow unused vars in tests
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '*.d.ts',
    ],
  },
];
