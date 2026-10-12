import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';

import { SplashScreen } from '@/components/ui/SplashScreen';
import { resolvePostLoginPath } from '@/utils/redirect';

import { useSession } from '../hooks/useSession';

/** Sign-in/up pages: signed-in users go straight to where they were headed. */
export function GuestOnly() {
  const { user, isLoading } = useSession();
  const [params] = useSearchParams();
  const location = useLocation();

  if (isLoading) return <SplashScreen />;
  // `signedOut` is set by logout, which navigates here just before clearing the session.
  if (user && !location.state?.signedOut) {
    return <Navigate to={resolvePostLoginPath(user, params.get('next'))} replace />;
  }
  return <Outlet />;
}
