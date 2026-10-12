import { useQuery } from '@tanstack/react-query';

import { authService } from '@/services/authService';

import { AUTH_QUERY_KEY } from '../constants';

/** The signed-in user (or null). React Query's cache is the single source of truth. */
export function useSession() {
  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authService.me,
    staleTime: Infinity,
    retry: false,
  });

  const user = query.data ?? null;
  return {
    user,
    role: user?.role ?? null,
    isLoading: query.isPending,
    isAuthenticated: Boolean(user),
  };
}
