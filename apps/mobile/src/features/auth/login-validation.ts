import { fr } from '../../i18n/fr';

/**
 * Client-side validation for the sign-in form.
 *
 * **It exists to save a round trip, never to decide anything.** The API
 * validates the same fields (`LoginDto`) and would refuse a malformed request
 * regardless. What this buys is that someone who mistypes their address is
 * told immediately instead of after a network call and a bcrypt verification.
 *
 * Note what is NOT checked: password strength. The server deliberately applies
 * `@MinLength(1)` at sign-in and nothing more —
 *
 *   apps/api/src/modules/auth/dto/login.dto.ts
 *   "Applying the real policy here would tell an attacker the minimum length
 *    before they ever guess a password, and would reject a legacy credential
 *    that no longer meets a tightened rule."
 *
 * Enforcing a length here would leak exactly what the server refuses to, and
 * lock out the user who most needs to sign in — the one whose password no
 * longer meets a rule tightened since.
 */
export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

/**
 * Deliberately permissive: "something@something.something" and no more.
 *
 * A stricter expression rejects addresses that are legal and in use, and the
 * only authority on whether an address works is the server that has it on
 * record. This catches the typo, not the exotic.
 */
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = fr.auth.emailRequired;
  } else if (!EMAIL_SHAPE.test(trimmedEmail)) {
    errors.email = fr.auth.emailInvalid;
  }

  // Not trimmed. A password may legitimately begin or end with a space, and
  // silently removing it would fail a correct credential with no explanation.
  if (!password) {
    errors.password = fr.auth.passwordRequired;
  }

  return errors;
}

export function hasErrors(errors: LoginFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
