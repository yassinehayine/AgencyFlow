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

  // Prettier owns formatting entirely (00-Project-Foundation.md 11.3).
  // Must remain last so it can switch off conflicting stylistic rules.
  prettier,
);
