import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { doubtService } from '@/services/doubtService';

export const DOUBT_KEYS = {
  all: ['student', 'doubts'],
  detail: (doubtId) => ['student', 'doubts', doubtId],
};

export function useDoubts() {
  return useQuery({ queryKey: DOUBT_KEYS.all, queryFn: doubtService.list });
}

export function useDoubt(doubtId) {
  return useQuery({
    queryKey: DOUBT_KEYS.detail(doubtId),
    queryFn: () => doubtService.get(doubtId),
    enabled: Boolean(doubtId),
    // A saved board never changes; refetching would restart the replay.
    staleTime: Infinity,
  });
}

export function useDeleteDoubt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doubtService.remove,
    onSuccess: (_, doubtId) => {
      queryClient.removeQueries({ queryKey: DOUBT_KEYS.detail(doubtId) });
      queryClient.invalidateQueries({ queryKey: DOUBT_KEYS.all, exact: true });
    },
  });
}
