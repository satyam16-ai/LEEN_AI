import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminUsersService } from '@/services/adminUsersService';

const USERS_KEY = ['admin', 'users'];
const userKey = (userId) => ['admin', 'user', userId];

export function useAdminUsers(params) {
  return useQuery({
    queryKey: [...USERS_KEY, params],
    queryFn: () => adminUsersService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(userId) {
  return useQuery({ queryKey: userKey(userId), queryFn: () => adminUsersService.get(userId) });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminUsersService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useUpdateUser(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes) => adminUsersService.update(userId, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKey(userId) });
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}

export function useSendPasswordReset(userId) {
  return useMutation({ mutationFn: () => adminUsersService.sendPasswordReset(userId) });
}
