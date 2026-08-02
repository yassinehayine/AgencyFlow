import { Navigate } from 'react-router-dom';

import { homePath } from '../app/routes';
import { useAuth } from '../features/auth/AuthContext';

/**
 * `/` — routes by role (09-Frontend-Design.md §1.1).
 *
 * A component rather than a static redirect because the destination depends on
 * who is asking, and the answer is a fact about them rather than a preference:
 * agency staff belong in `/app`, a client belongs in `/portal`, and neither
 * should have to know that.
 */
export function LandingRedirect() {
  const { user } = useAuth();

  return <Navigate to={homePath(user)} replace />;
}
