import type { AuthenticatedUser, LoginRequest, LoginResponse, Role } from '@agencyflow/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { apiRequest } from '../../lib/api-client';
import { clearSession, loadSession, saveSession } from './auth-session';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The authenticated identity, held in Context (09-Frontend-Design.md 4.1).
 *
 * Identity is client state, not server state, so it does not belong in
 * TanStack Query: it changes only when the user acts, there is nothing to
 * refetch, and a cache eviction must never log someone out.
 *
 * The initial value is read synchronously from storage rather than in an
 * effect. Reading it in an effect would render one frame as "logged out",
 * which is enough for a protected route to redirect to the login page before
 * the session has been restored.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => loadSession()?.user ?? null);
  const queryClient = useQueryClient();

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: credentials,
    });

    saveSession({ token: response.accessToken, user: response.user });
    setUser(response.user);

    return response.user;
  }, []);

  const logout = useCallback(async () => {
    // Told to the server first so the exchange has an explicit end, but the
    // local session is cleared regardless of the outcome: a failed network
    // call must never leave a user apparently logged in (FR-004).
    await apiRequest<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);

    clearSession();
    setUser(null);

    // Every cached query was fetched under the previous identity. Clearing
    // rather than invalidating means none of it can be shown to the next user
    // while a refetch is in flight - which for a different client organisation
    // would be a BR-10 breach on the client side.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      logout,
      hasRole: (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Throws outside the provider rather than returning null. A component that
 * silently believed nobody was logged in would render the wrong interface
 * instead of failing visibly during development.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }

  return context;
}
