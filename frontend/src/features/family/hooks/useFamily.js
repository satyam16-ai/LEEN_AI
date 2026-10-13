import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { familyService } from '@/services/familyService';

export const FAMILY_KEYS = {
  linkCode: ['student', 'link-code'],
  parents: ['student', 'parents'],
  children: ['parent', 'children'],
};

// Student side — the code rotates when a parent uses it, so refetch on focus.
export function useLinkCode() {
  return useQuery({
    queryKey: FAMILY_KEYS.linkCode,
    queryFn: familyService.getLinkCode,
    refetchOnWindowFocus: true,
  });
}

export function useRegenerateLinkCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: familyService.regenerateLinkCode,
    onSuccess: (code) => queryClient.setQueryData(FAMILY_KEYS.linkCode, code),
  });
}

export function useLinkedParents() {
  return useQuery({
    queryKey: FAMILY_KEYS.parents,
    queryFn: familyService.listParents,
    refetchOnWindowFocus: true,
  });
}

export function useRemoveParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: familyService.removeParent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAMILY_KEYS.parents }),
  });
}

// Parent side
export function useChildren() {
  return useQuery({ queryKey: FAMILY_KEYS.children, queryFn: familyService.listChildren });
}

export function useLinkChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: familyService.linkChild,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAMILY_KEYS.children }),
  });
}

export function useUnlinkChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: familyService.unlinkChild,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAMILY_KEYS.children }),
  });
}
