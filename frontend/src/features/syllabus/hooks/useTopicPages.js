import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { documentService } from '@/services/documentService';

export const PAGE_KEYS = {
  all: ['student', 'documents'],
  list: (subject) => ['student', 'documents', subject],
};

const isReading = (page) => page.status === 'queued' || page.status === 'reading';

/** Every page the student added for `subject`; polls while the Librarian is reading any. */
export function useSubjectPages(subject) {
  return useQuery({
    queryKey: PAGE_KEYS.list(subject),
    queryFn: () => documentService.list({ subject }),
    enabled: Boolean(subject),
    refetchInterval: (query) => (query.state.data?.some(isReading) ? 2000 : false),
  });
}

export function useUploadPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: documentService.upload,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAGE_KEYS.all }),
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: documentService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAGE_KEYS.all }),
  });
}
