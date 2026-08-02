import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth/AuthContext';
import { fr } from '../../i18n/fr';

/**
 * The client portal shell — everything under `/portal` (FR-073, NFR-08).
 *
 * **Designed for a phone first, and widened afterwards.** SRS §3 (A-4) is
 * explicit that the Client Contact is the only external, occasional,
 * non-technical user and the one most likely to be holding a phone — and their
 * primary action, deciding on a deliverable, has to be reachable immediately
 * on login. The acceptance bar is TC-073: every client action completable at
 * **375 px with no horizontal scrolling**.
 *
 * What that costs, concretely, and why it is a separate component rather than
 * a media query on `AppLayout`:
 *
 *   - the header is one row of two items, not a navigation bar. There is
 *     nowhere else to go: the dashboard is the only top-level page a client
 *     has, so a nav bar would be a row of chrome earning nothing.
 *   - horizontal padding is 4 (16 px) rather than 6, because at 375 px a
 *     24 px gutter on each side is 13% of the screen.
 *   - the name is truncated rather than wrapped, so a long one cannot push the
 *     logout button off the row.
 *
 * There is deliberately no route to tasks, to the team roster or to internal
 * activity, here or anywhere under `/portal` (BR-28).
 */
export function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <span className="text-base font-semibold text-slate-900">{fr.common.appName}</span>

        {/* `min-w-0` is what actually allows the truncation below: a flex item
            will not shrink past its content without it, and the button would
            be pushed off-screen instead. */}
        <span className="min-w-0 flex-1 truncate text-right text-sm text-slate-600">
          {user?.name}
        </span>

        <button
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          type="button"
          onClick={() => void handleLogout()}
        >
          {fr.auth.logout}
        </button>
      </header>

      <Outlet />
    </div>
  );
}
