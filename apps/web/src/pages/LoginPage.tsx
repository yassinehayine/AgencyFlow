import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Field, INPUT_CLASS } from '../components/shared/Field';
import { useAuth } from '../features/auth/AuthContext';
import { fr } from '../i18n/fr';
import { ApiError } from '../lib/api-client';

/**
 * FR-001 — the only unauthenticated page.
 *
 * There is no "create an account" link, and its absence is the interface half
 * of FR-007: accounts exist only because an Administrator made one (BR-11).
 */
export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  /**
   * Where the user was heading before being redirected here.
   *
   * The fallback is `/`, not a page: which tree someone lands in depends on
   * their role, and `/` is the one route that works that out (FR-071 sends a
   * Client Contact to their portal, everyone else to the workspace).
   */
  const destination = (location.state as { from?: string } | null)?.from ?? '/';

  if (isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      navigate(destination, { replace: true });
    } catch (caught) {
      // The API's 401 message is already French, generic and correct for every
      // cause. Anything else is a network or server problem and must not be
      // reported as a credential failure: a user told their password is wrong
      // will keep retyping a password that was never the problem.
      setError(
        caught instanceof ApiError && caught.status === 401 ? caught.message : fr.common.error,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
        onSubmit={handleSubmit}
        noValidate
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{fr.common.appName}</h1>
          <p className="mt-1 text-sm text-slate-600">{fr.auth.loginSubtitle}</p>
        </div>

        <Field label={fr.auth.email}>
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              className={INPUT_CLASS}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>

        <Field label={fr.auth.password}>
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              className={INPUT_CLASS}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        {/* role="alert" so the failure is announced, rather than leaving a
            screen-reader user with a form that silently did nothing. */}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? fr.auth.submitting : fr.auth.submit}
        </button>
      </form>
    </main>
  );
}
