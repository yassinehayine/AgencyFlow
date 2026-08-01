// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Root ESLint configuration for the AgencyFlow monorepo.
 *
 * Standards are frozen in 00-Project-Foundation.md sections 11 and 12.
 * Workspaces extend this file rather than redefining rules, so that the
 * api and web applications cannot drift into different standards.
 *
 * Module boundary rules (05-Software-Architecture.md section 7.3, rules R2
 * and R4) are added in the slice that introduces the first feature modules;
 * there are no module directories to constrain yet.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/node_modules/**', '**/.vite/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // 00-Project-Foundation.md 11.2 — `any` disables type checking for
      // everything it touches and propagates silently. Prefer `unknown`.
      '@typescript-eslint/no-explicit-any': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // 00-Project-Foundation.md 11.6 — use the framework logger instead.
      'no-console': 'error',

      // 00-Project-Foundation.md 11.7 — a swallowed error is a defect.
      'no-empty': ['error', { allowEmptyCatch: false }],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Operational scripts: plain CommonJS, run with node against the compiled
  // output. They are diagnostics, not application code - reporting to stdout
  // is their entire purpose, and they cannot import ESM from dist.
  // Scoped narrowly so the rules above stay strict everywhere else.
  {
    files: ['**/scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Node 18+ globals. The scripts talk to a running instance over HTTP,
        // which needs no dependency any more.
        fetch: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },

  // Prettier owns formatting entirely (00-Project-Foundation.md 11.3).
  // Must remain last so it can switch off conflicting stylistic rules.
  prettier,
);
