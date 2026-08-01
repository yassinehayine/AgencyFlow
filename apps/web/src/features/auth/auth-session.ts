import type { AuthenticatedUser } from '@agencyflow/contracts';

import { setAccessToken } from '../../lib/api-client';

const TOKEN_KEY = 'agencyflow.token';
const USER_KEY = 'agencyflow.user';

/**
 * Where the session lives between page loads.
 *
 * **`sessionStorage`, not `localStorage`, and not memory only.**
 *
 * BR-13 rules out persistent sessions: no "remember me", no refresh token,
 * nothing that outlives the 12-hour JWT. `localStorage` would break that — it
 * survives closing the browser and would keep a token alive on a shared
 * machine.
 *
 * Memory only would honour the rule most literally, and would also log the
 * user out on every page refresh. That is not a security property, it is a
 * defect: an accidental F5 in the middle of entering a project would discard
 * the work and the session.
 *
 * `sessionStorage` sits exactly where the rule intends — the session lasts for
 * one browser tab, dies when the tab closes, and is still capped by the token's
 * own 12-hour expiry. It is no more exposed to XSS than a module variable
 * would be: both are readable by any script running in the page.
 */
export interface StoredSession {
  token: string;
  user: AuthenticatedUser;
}

export function loadSession(): StoredSession | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const rawUser = sessionStorage.getItem(USER_KEY);

  if (!token || !rawUser) {
    return null;
  }

  try {
    const session = { token, user: JSON.parse(rawUser) as AuthenticatedUser };
    setAccessToken(token);
    return session;
  } catch {
    // Corrupt or hand-edited storage. Discard rather than crash the shell:
    // the worst outcome is one extra login, and the alternative is a white
    // screen the user cannot recover from without clearing site data.
    clearSession();
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
  setAccessToken(session.token);
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  setAccessToken(null);
}
