import type { AuthenticatedUser } from '@agencyflow/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { setAccessToken } from '../../api/client';
import { clearSession, loadSession, saveSession } from './session-storage';
import type { SessionStatus } from './session-routing';
import type { StoredSession } from './session-storage';

/**
 * The signed-in identity, held in context.
 *
 * **`status` is three-valued, and that is the whole design.** The web client
 * reads its session synchronously from `sessionStorage`, so it can answer
 * "logged in?" on the first render. A device cannot: the Keystore is
 * asynchronous, so there is a real moment where the answer is *not yet known*.
 *
 * Collapsing that moment into `false` is the classic bug — every guard fires,
 * the user watches the login screen appear and vanish, and a deep link is lost
 * on the way. `loading` exists so the guards can decline to act until there is
 * something to act on.
 */
interface SessionContextValue {
  status: SessionStatus;
  session: StoredSession | null;
  user: AuthenticatedUser | null;
  /** Phase 3 calls this after `POST /auth/login` succeeds. */
  signIn: (session: StoredSession) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [session, setSession] = useState<StoredSession | null>(null);

  // Restore once, on mount. `loadSession` never rejects, so there is no error
  // branch to handle — an unreadable session is simply no session.
  useEffect(() => {
    let cancelled = false;

    void loadSession().then((restored) => {
      // The component can unmount before the Keystore answers. Setting state
      // then is a warning at best and a leak at worst.
      if (cancelled) {
        return;
      }

      // The API client holds the working copy for this process. Set here, on
      // sign-in and on sign-out — the three moments the session changes — so
      // no request path ever has to read the Keystore.
      setAccessToken(restored?.token ?? null);
      setSession(restored);
      setStatus(restored ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (next: StoredSession) => {
    // Persisted BEFORE the state changes. If the write fails, the navigation
    // never happens and the user sees the failure — rather than reaching the
    // portal with a session that will be gone when they reopen the app.
    await saveSession(next);
    setAccessToken(next.token);
    setSession(next);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    // The opposite order, for the same reason. Local state is cleared whatever
    // the storage layer does: a failed delete must never leave someone
    // apparently signed in after they asked to leave (FR-004).
    setAccessToken(null);
    setSession(null);
    setStatus('unauthenticated');
    await clearSession();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, session, user: session?.user ?? null, signIn, signOut }),
    [status, session, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Throws outside the provider rather than returning a default. A screen that
 * silently believed nobody was signed in would render the wrong thing instead
 * of failing visibly in development.
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside <SessionProvider>.');
  }

  return context;
}
