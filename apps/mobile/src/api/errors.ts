import type { ApiErrorDetail } from '@agencyflow/contracts';

import { fr } from '../i18n/fr';

/**
 * What went wrong with a request, in a shape a screen can act on.
 *
 * **`kind` rather than a bare status code**, because the three cases below
 * need three different responses from the interface and a number does not
 * separate them:
 *
 *   `network`  the request never arrived — offer to retry
 *   `api`      the server answered and refused — show ITS message
 *   `timeout`  it arrived and nothing came back — offer to retry
 *
 * Nothing here ever carries a token or a password. `ApiError` is the type that
 * gets rendered, attached to state, and (in future) reported — so a credential
 * inside one would leak by whichever of those happened first.
 */
export type ApiErrorKind = 'network' | 'timeout' | 'api';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(init: {
    kind: ApiErrorKind;
    status: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
  }

  /** A 401 on an authenticated call means the session is no longer usable. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

/**
 * The sentence to show a user.
 *
 * **The API's own message wins whenever there is one.** It is already French,
 * already specific to the rule that was broken, and it is the single source of
 * that wording — a mobile translation table would be a second copy free to
 * drift from the server's. Only the cases the server cannot describe, because
 * it never answered, are worded here.
 */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return fr.errors.network;
      case 'timeout':
        return fr.errors.timeout;
      case 'api':
        return error.message;
    }
  }

  return fr.errors.unexpected;
}
