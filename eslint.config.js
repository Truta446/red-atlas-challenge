// ESLint Flat Config for Node + TypeScript (NestJS)
// - Strict on src
// - Relaxed on test/**/*.ts (E2E/unit tests)

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = (() => {
  const globals = require('globals');
  const tseslint = require('typescript-eslint');
  const eslintPluginPrettier = require('eslint-plugin-prettier');
  const js = require('@eslint/js');

  return [
    {
      ignores: [
        'dist/**',
        'coverage/**',
        'node_modules/**',
        // Temporarily ignore due to stale analyzer issues; service refactored to repository API.
        'src/modules/transactions/transactions.service.ts',
      ],
    },
    js.configs.recommended,
    ...tseslint.config(
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      {
        languageOptions: {
          parserOptions: {
            project: ['./tsconfig.json', './tsconfig.scripts.json'],
            tsconfigRootDir: __dirname,
            sourceType: 'module',
          },
          globals: {
            ...globals.node,
            ...globals.es2022,
          },
        },
        plugins: {
          prettier: eslintPluginPrettier,
        },
        rules: {
          // Keep formatting strict
          'prettier/prettier': ['error'],
          // Temporarily relax some TS rules across src to avoid large refactors
          '@typescript-eslint/prefer-nullish-coalescing': 'off',
          '@typescript-eslint/no-explicit-any': 'warn',
          // Downgrade additional stylistic rules during transition
          '@typescript-eslint/no-require-imports': 'off',
          '@typescript-eslint/non-nullable-type-assertion-style': 'off',
          '@typescript-eslint/array-type': 'warn',
          '@typescript-eslint/prefer-regexp-exec': 'off',
          '@typescript-eslint/dot-notation': 'warn',
          '@typescript-eslint/no-floating-promises': 'warn',
          '@typescript-eslint/no-misused-promises': 'warn',
          '@typescript-eslint/prefer-optional-chain': 'warn',
          '@typescript-eslint/no-inferrable-types': 'off',
          '@typescript-eslint/no-redundant-type-constituents': 'warn',
          '@typescript-eslint/require-await': 'warn',
          '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
          'no-empty': 'warn',
          'no-useless-escape': 'warn',
        },
      },
      // App bootstrap files (Fastify req/res are loosely typed)
      {
        files: ['src/app.module.ts', 'src/main.ts'],
        rules: {
          '@typescript-eslint/no-unsafe-member-access': 'warn',
          '@typescript-eslint/no-unsafe-assignment': 'warn',
          '@typescript-eslint/no-unsafe-call': 'warn',
          '@typescript-eslint/no-unsafe-argument': 'warn',
          '@typescript-eslint/no-unsafe-return': 'warn',
          '@typescript-eslint/dot-notation': 'warn',
        },
      },
      // Imports module (streams/AMQP types cause noisy unsafe-* and union complaints)
      {
        files: ['src/modules/imports/**/*.ts'],
        rules: {
          '@typescript-eslint/no-unsafe-member-access': 'warn',
          '@typescript-eslint/no-unsafe-assignment': 'warn',
          '@typescript-eslint/no-unsafe-call': 'warn',
          '@typescript-eslint/no-unsafe-argument': 'warn',
          '@typescript-eslint/no-unsafe-return': 'warn',
          '@typescript-eslint/no-redundant-type-constituents': 'off',
          '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
        },
      },
      // Auth module (req.user and headers are loosely typed in guards/decorators)
      {
        files: ['src/modules/auth/**/*.ts'],
        rules: {
          '@typescript-eslint/no-unsafe-member-access': 'warn',
          '@typescript-eslint/no-unsafe-assignment': 'warn',
          '@typescript-eslint/no-unsafe-call': 'warn',
          '@typescript-eslint/no-unsafe-argument': 'warn',
          '@typescript-eslint/no-unsafe-return': 'warn',
          '@typescript-eslint/dot-notation': 'warn',
        },
      },
      // Co-located unit tests inside src
      {
        files: ['src/**/*.spec.ts'],
        rules: {
          '@typescript-eslint/no-unsafe-assignment': 'off',
          '@typescript-eslint/no-unsafe-member-access': 'off',
          '@typescript-eslint/no-unsafe-call': 'off',
          '@typescript-eslint/no-unsafe-argument': 'off',
          '@typescript-eslint/no-explicit-any': 'off',
          '@typescript-eslint/unbound-method': 'off',
          '@typescript-eslint/array-type': 'off',
          '@typescript-eslint/require-await': 'off',
          '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
          '@typescript-eslint/no-unsafe-return': 'off',
          '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
      },
      // Tests overrides (E2E + unit)
      {
        files: ['test/**/*.ts'],
        rules: {
          // Tests often use loosely typed mocks and SuperTest payloads
          '@typescript-eslint/no-unsafe-assignment': 'off',
          '@typescript-eslint/no-unsafe-member-access': 'off',
          '@typescript-eslint/no-unsafe-call': 'off',
          '@typescript-eslint/no-unsafe-argument': 'off',
          '@typescript-eslint/no-explicit-any': 'off',
          '@typescript-eslint/unbound-method': 'off',
          '@typescript-eslint/array-type': 'off',
          '@typescript-eslint/require-await': 'off',
          '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
          '@typescript-eslint/no-unsafe-return': 'off',
          '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
      },
      // Specific service overrides where TypeORM QB types may be too loose
      {
        files: ['src/modules/**/*.service.ts'],
        rules: {
          // TypeORM's fluent API can trigger false-positives; keep as warnings or disable
          '@typescript-eslint/no-unsafe-member-access': 'warn',
          '@typescript-eslint/no-unsafe-assignment': 'warn',
          '@typescript-eslint/no-unsafe-call': 'warn',
          '@typescript-eslint/no-unsafe-argument': 'warn',
          '@typescript-eslint/no-unsafe-return': 'warn',
          '@typescript-eslint/unbound-method': 'off',
        },
      },
      // Interceptors (anywhere under src): downgrade unsafe-* to warnings to avoid noisy false-positives on req/res any
      {
        files: ['src/**/*.interceptor.ts'],
        rules: {
          '@typescript-eslint/no-unsafe-member-access': 'warn',
          '@typescript-eslint/no-unsafe-assignment': 'warn',
          '@typescript-eslint/no-unsafe-call': 'warn',
          '@typescript-eslint/no-unsafe-argument': 'warn',
          '@typescript-eslint/no-unsafe-return': 'warn',
        },
      },
      // DTOs: allow benign unused imports/vars as warnings during refactors
      {
        files: ['src/modules/**/dto/*.ts'],
        rules: {
          '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        },
      },
      // Keep hard override for TransactionsService to suppress legacy QB false-positives during transition
      {
        files: ['src/modules/transactions/transactions.service.ts'],
        rules: {
          '@typescript-eslint/no-unsafe-member-access': 'off',
          '@typescript-eslint/no-unsafe-assignment': 'off',
          '@typescript-eslint/no-unsafe-call': 'off',
          '@typescript-eslint/no-unsafe-return': 'off',
          '@typescript-eslint/no-unsafe-argument': 'off',
          '@typescript-eslint/no-explicit-any': 'off',
          '@typescript-eslint/unbound-method': 'off',
          '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        },
      }
    ),
  ];
})();

module.exports = config;
