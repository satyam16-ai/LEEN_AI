import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { authService } from '@/services/authService';

import { broadcastAuthEvent } from '../authChannel';
import { AUTH_QUERY_KEY } from '../constants';

/** Drop all user data but keep a cached `null` session so guards don't refetch /me. */
export function clearSession(queryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== AUTH_QUERY_KEY[0] });
  queryClient.setQueryData(AUTH_QUERY_KEY, null);
}

function useSignedIn() {
  const queryClient = useQueryClient();
  return (user) => {
    queryClient.setQueryData(AUTH_QUERY_KEY, user);
    broadcastAuthEvent('login');
  };
}

export function useLogin() {
  const onSignedIn = useSignedIn();
  return useMutation({ mutationFn: authService.login, onSuccess: onSignedIn });
}

export function useRegister() {
  const onSignedIn = useSignedIn();
  return useMutation({ mutationFn: authService.register, onSuccess: onSignedIn });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authService.logout,
    onSettled: async () => {
      // Leave protected routes before clearing the session; otherwise RequireAuth
      // re-renders first and redirects to /login?next=<current page>.
      await navigate('/login', { replace: true, flushSync: true, state: { signedOut: true } });
      clearSession(queryClient);
      // Drop the transient flag so signing in again from this page redirects normally.
      navigate('/login', { replace: true });
      broadcastAuthEvent('logout');
      toast.success('You have been signed out');
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authService.forgotPassword });
}

export function useResetPassword() {
  return useMutation({ mutationFn: authService.resetPassword });
}

export function useChangePassword() {
  return useMutation({ mutationFn: authService.changePassword });
}
