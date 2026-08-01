import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * bcrypt cost factor. 06-Database-Design.md section 7.1 requires at least 10;
 * 12 is used because the hash is computed at most twice per session (login and
 * password change) and roughly 250 ms of work is an acceptable price for two
 * extra doublings of an attacker's cost.
 */
const BCRYPT_COST = 12;

/**
 * Password hashing and verification.
 *
 * **Why this lives in `core/` and not in `AuthModule`.**
 * `08-Backend-Design.md` section 1.2 assigns password hashing to `AuthModule`,
 * which also depends on `UsersModule`. But `UsersService` must hash a password
 * when an Administrator creates an account (FR-008) — so putting the hashing
 * there would make `UsersModule` depend on `AuthModule` and close a dependency
 * cycle, which `05-Software-Architecture.md` section 7 rule R2 forbids.
 *
 * A core service resolves it without weakening anything: core modules are
 * depended upon and depend on nothing (rule R1), so both `AuthModule` and
 * `UsersModule` can use it and the graph stays one-directional. The blueprint's
 * intent — one place owns hashing — is preserved; only the address changes.
 */
@Injectable()
export class PasswordService {
  hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, BCRYPT_COST);
  }

  /**
   * Verifies a candidate against a stored hash.
   *
   * bcrypt's own comparison is constant-time for a given hash, so a wrong
   * password and a right one cost the same. The caller must still take care
   * not to leak WHICH check failed (FR-001).
   */
  verify(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}
