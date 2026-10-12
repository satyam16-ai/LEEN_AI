import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { SplashScreen } from '@/components/ui/SplashScreen';

import { useSession } from '../hooks/useSession';

export function RequireAuth() {
  const { user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return <SplashScreen />;
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
