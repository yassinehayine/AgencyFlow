/**
 * Conventional Commits enforcement (00-Project-Foundation.md section 10).
 *
 * A convention that relies on discipline decays by week two, so it is
 * validated by a commit-msg hook and rejected locally before the commit
 * exists.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    // Scopes are fixed and small (00-Project-Foundation.md 10.4).
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'contracts', 'config', 'db', 'auth', 'docs', 'ci', 'deps', 'repo'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
