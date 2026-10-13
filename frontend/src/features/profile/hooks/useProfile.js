import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AUTH_QUERY_KEY } from '@/features/auth/constants';
import { profileService } from '@/services/profileService';

export const PROFILE_QUERY_KEY = ['profile'];

export function useProfile() {
  return useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: profileService.get });
}

/** Keep the session user (topbar, menus) in sync with profile changes. */
function useApplyUser() {
  const queryClient = useQueryClient();
  return (user) => {
    queryClient.setQueryData(AUTH_QUERY_KEY, user);
    queryClient.setQueryData(PROFILE_QUERY_KEY, (current) =>
      current ? { ...current, user } : current
    );
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileService.update,
    onSuccess: (profile) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
      queryClient.setQueryData(AUTH_QUERY_KEY, profile.user);
    },
  });
}

export function useUploadAvatar() {
  const applyUser = useApplyUser();
  return useMutation({ mutationFn: profileService.uploadAvatar, onSuccess: applyUser });
}

export function useRemoveAvatar() {
  const applyUser = useApplyUser();
  return useMutation({ mutationFn: profileService.removeAvatar, onSuccess: applyUser });
}
