import type { LoginRequest, LoginResponse } from '@agencyflow/contracts';
import { useCallback, useState } from 'react';

import { apiRequest } from '../../api/client';
import { messageFor } from '../../api/errors';
import { fr } from '../../i18n/fr';
import { useSession } from './SessionContext';
import { isPortalUser } from './session-routing';

/**
 * The sign-in exchange (FR-001, FR-002).
 *
 * Holds the whole outcome — submitting, error, success — so the screen stays
 * a rendering of state rather than a place where the flow is decided.
 */
export type LoginOutcome =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'error'; message: string }
  /**
   * A valid account that this application is not built for. Kept separate
   * from `error` because it is not a failure the user can fix by retyping,
   * and the screen presents it differently.
   */
  | { state: 'rejected'; title: string; message: string };

export function useLogin() {
  const { signIn, signOut } = useSession();
  const [outcome, setOutcome] = useState<LoginOutcome>({ state: 'idle' });

  const reset = useCallback(() => setOutcome({ state: 'idle' }), []);

  const submit = useCallback(
    async (credentials: LoginRequest) => {
      setOutcome({ state: 'submitting' });

      try {
        const response = await apiRequest<LoginResponse>('/auth/login', {
          method: 'POST',
          body: credentials,
          // The one call made without a session — there is none yet.
          anonymous: true,
        });

        // ADR-0007 — the mobile application serves the Client Portal. An
        // agency account authenticates perfectly well; there is simply nothing
        // here for it, so it is stopped BEFORE anything is persisted.
        //
        // This is a usability boundary and not a security one: the API applies
        // BR-10 and BR-28 to every request whatever client sent it, and a
        // determined Project Manager could call the API directly. What this
        // prevents is stranding one on a portal that describes projects they
        // cannot act on.
        if (!isPortalUser(response.user)) {
          // Nothing was saved, so there is nothing to undo — but a stale
          // session from an earlier sign-in might still be on the device, and
          // leaving it would let the guard admit the wrong person on relaunch.
          await signOut();

          setOutcome({
            state: 'rejected',
            title: fr.auth.portalOnlyTitle,
            message: fr.auth.portalOnlyBody,
          });
          return;
        }

        // Persisted before the state changes, so a failed write surfaces here
        // rather than as a session that vanishes on the next launch.
        await signIn({ token: response.accessToken, user: response.user });

        // No `setOutcome` on success, deliberately. The session change causes
        // the guard to redirect and unmount this screen; setting state on the
        // way out is a React warning and buys nothing.
      } catch (caught) {
        // `messageFor` prefers the API's own French message. A failed sign-in
        // returns the same sentence for an unknown address, a wrong password
        // and a deactivated account — one response for three causes, by
        // design (FR-001, `auth.service.ts`). Rewording it here would either
        // duplicate it or invent a distinction the server refuses to make.
        setOutcome({ state: 'error', message: messageFor(caught) });
      }
    },
    [signIn, signOut],
  );

  return { outcome, submit, reset };
}
