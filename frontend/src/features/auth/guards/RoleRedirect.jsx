import { Navigate } from 'react-router-dom';

import { ROLE_HOME } from '../constants';
import { useSession } from '../hooks/useSession';

/** Sends a signed-in user to their role's home. Nest inside RequireAuth. */
export function RoleRedirect() {
  const { user } = useSession();
  return <Navigate to={ROLE_HOME[user?.role] ?? '/'} replace />;
}
