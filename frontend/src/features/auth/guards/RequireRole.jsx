import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSession } from '../hooks/useSession';

/** Must be nested inside RequireAuth. */
export function RequireRole({ roles }) {
  const { user } = useSession();
  const location = useLocation();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/403" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
