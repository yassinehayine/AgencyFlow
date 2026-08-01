import { Role } from '@agencyflow/contracts';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth/AuthContext';
import { fr } from '../../i18n/fr';

/**
 * The authenticated shell (09-Frontend-Design.md section 2).
 *
 * Navigation shows only what the user's role can use. That is presentation
 * only — every hidden route is refused by the server independently (FR-003) —
 * but a link that leads to a refusal teaches users to distrust the interface.
 */
export function AppLayout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'rounded-md px-3 py-1.5 text-sm font-medium bg-slate-900 text-white'
      : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200';

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-base font-semibold text-slate-900">{fr.common.appName}</span>

        <nav className="flex gap-1" aria-label={fr.common.appName}>
          {hasRole(Role.ADMINISTRATOR) && (
            <NavLink to="/users" className={linkClass}>
              {fr.nav.users}
            </NavLink>
          )}
          {hasRole(Role.ADMINISTRATOR, Role.PROJECT_MANAGER) && (
            <NavLink to="/clients" className={linkClass}>
              {fr.nav.clients}
            </NavLink>
          )}
          <NavLink to="/status" className={linkClass}>
            {fr.nav.status}
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-600">
            {user?.name} · {user ? fr.roles[user.role] : ''}
          </span>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            type="button"
            onClick={() => void handleLogout()}
          >
            {fr.auth.logout}
          </button>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
