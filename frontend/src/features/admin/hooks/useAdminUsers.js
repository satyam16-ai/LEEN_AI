import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminUsersService } from '@/services/adminUsersService';

const USERS_KEY = ['admin', 'users'];

export function useAdminUsers(params) {
  return useQuery({
    queryKey: [...USERS_KEY, params],
    queryFn: () => adminUsersService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminUsersService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
