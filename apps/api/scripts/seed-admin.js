/**
 * Creates the bootstrap Administrator.
 *
 * FR-007 and BR-11 mean there is no registration endpoint: every account
 * exists because an Administrator created it. That leaves a chicken-and-egg
 * problem — a freshly deployed system has no Administrator and therefore no
 * way to ever get one. This script is the only door, and it is deliberately
 * outside the HTTP surface: nothing reachable over the network can create an
 * Administrator from nothing.
 *
 * Idempotent. If an active Administrator already exists it changes nothing and
 * exits successfully, so it is safe in a deploy hook that runs on every
 * release.
 *
 *   npm run build --workspace @agencyflow/api
 *   SEED_ADMIN_NAME="..." SEED_ADMIN_USERNAME="..." \
 *   SEED_ADMIN_EMAIL="..." SEED_ADMIN_PASSWORD="..." \
 *   npm run seed:admin --workspace @agencyflow/api
 */
const { NestFactory } = require('@nestjs/core');
const { Role, PASSWORD_MIN_LENGTH, USERNAME_PATTERN } = require('@agencyflow/contracts');
const { AppModule } = require('../dist/app.module');
const { AccessScope } = require('../dist/core/authorization/access-scope');
const { UsersService } = require('../dist/modules/users/users.service');
const { UsersRepository } = require('../dist/modules/users/users.repository');

/**
 * The DTO is bypassed here, so its validation is too.
 *
 * Calling the service directly skips the ValidationPipe entirely, and a seed
 * that silently created an account with a four-character password would be
 * worse than one that refused to run. These checks restore what the HTTP
 * boundary would have done.
 */
function readInput() {
  const input = {
    name: process.env.SEED_ADMIN_NAME,
    username: (process.env.SEED_ADMIN_USERNAME || '').toLowerCase().trim(),
    email: (process.env.SEED_ADMIN_EMAIL || '').toLowerCase().trim(),
    password: process.env.SEED_ADMIN_PASSWORD,
    role: Role.ADMINISTRATOR,
  };

  const problems = [];

  if (!input.name || input.name.trim().length < 2) {
    problems.push('SEED_ADMIN_NAME must be at least 2 characters');
  }
  if (!USERNAME_PATTERN.test(input.username)) {
    problems.push('SEED_ADMIN_USERNAME must be lowercase, 3-30 chars, letters/digits/._-');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) {
    problems.push('SEED_ADMIN_EMAIL must be a valid address');
  }
  if (!input.password || input.password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`SEED_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  if (problems.length > 0) {
    console.error('Cannot seed. Fix all of the following:\n');
    problems.forEach((problem) => console.error(`  - ${problem}`));
    console.error('');
    process.exit(1);
  }

  return input;
}

async function main() {
  const input = readInput();

  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const repository = context.get(UsersRepository);
    const existing = await repository.countActiveAdministrators();

    if (existing > 0) {
      console.log(
        `An active Administrator already exists (${existing}). Nothing to do.\n` +
          'Further accounts are created through the API, as intended (BR-11).',
      );
      return;
    }

    // The system scope is the only correct actor: there is no user yet, and
    // `createdBy` is nullable precisely for records the system seeds itself.
    const created = await context.get(UsersService).createStaff(input, AccessScope.systemScope());

    console.log(`Administrator created: ${created.email} (username: ${created.username})`);
    console.log('Log in through the web client and create the rest of the team from there.');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  // Domain exceptions already carry a French, human message; anything else is
  // a genuine failure and its detail is what makes it fixable.
  console.error(`\nSeeding failed: ${error.message}\n`);
  process.exit(1);
});
