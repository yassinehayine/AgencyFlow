/**
 * Guarded Husky installation — the `prepare` lifecycle script.
 *
 * `prepare` runs after every `npm install` and `npm ci`, everywhere: on a
 * developer machine, in CI, and inside a production build on Vercel or
 * Railway. Only the first of those has any use for Git hooks, and the other
 * two do not reliably have Husky installed to run.
 *
 * That mismatch is what broke the Vercel build:
 *
 *     sh: line 1: husky: command not found
 *     npm ERR! command sh -c husky
 *
 * The message names Husky, which makes it read like a Husky problem. It is
 * not: `prepare` was asked to run a devDependency binary in an install that
 * had no reason to contain one.
 *
 * **The guard runs before the import, and that ordering is the whole point.**
 * A `try/catch` around `import('husky')`, or a `husky || true` in the script,
 * would also silence the error — but both silence it by swallowing a failure
 * rather than by declining to act. This exits first and imports second, so
 * the module is only ever loaded where it is genuinely wanted. Locally, a
 * real Husky failure is still a real failure, loudly, which is what keeps the
 * hooks trustworthy (00-Project-Foundation §14.4: with a solo developer these
 * checks ARE the review).
 */

/**
 * Every signal that means "this is not a developer's machine".
 *
 * `CI` is checked for truthiness rather than against `'true'`: GitHub Actions
 * sets `CI=true`, Vercel sets `CI=1`, and a comparison against either one
 * alone silently fails on the other. `VERCEL` and `RAILWAY_ENVIRONMENT` are
 * belt and braces — both platforms already set `CI`, but a platform that
 * quietly stops doing so should not resurrect this bug.
 */
const isAutomatedEnvironment =
  process.env.CI ||
  process.env.VERCEL ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.NODE_ENV === 'production' ||
  // npm sets this when installing without devDependencies, which is exactly
  // the case where the husky binary will not exist.
  process.env.npm_config_production === 'true';

if (isAutomatedEnvironment) {
  process.exit(0);
}

const husky = (await import('husky')).default;

// Husky prints its own status; forwarding it keeps `npm install` honest about
// what it just did to the repository's Git configuration.
const output = husky();

if (output) {
  console.log(output);
}
