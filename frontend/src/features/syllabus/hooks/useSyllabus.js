import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { syllabusService } from '@/services/syllabusService';

export const SYLLABUS_KEYS = {
  all: ['student', 'syllabus'],
  detail: (subject) => ['student', 'syllabus', subject],
};

// While the AI reads a contents page, check back every few seconds.
const READING_POLL_MS = 2000;

export function useSyllabusSubjects() {
  return useQuery({
    queryKey: SYLLABUS_KEYS.all,
    queryFn: syllabusService.list,
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.status === 'reading') ? READING_POLL_MS * 2 : false,
  });
}

export function useSyllabus(subject) {
  return useQuery({
    queryKey: SYLLABUS_KEYS.detail(subject),
    queryFn: () => syllabusService.get(subject),
    enabled: Boolean(subject),
    refetchInterval: (query) =>
      query.state.data?.status === 'reading' ? READING_POLL_MS : false,
  });
}

function useTreeMutation(subject, mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (tree) => {
      queryClient.setQueryData(SYLLABUS_KEYS.detail(subject), tree);
      queryClient.invalidateQueries({ queryKey: SYLLABUS_KEYS.all, exact: true });
    },
  });
}

export function useSaveSyllabus(subject) {
  return useTreeMutation(subject, (body) => syllabusService.save(subject, body));
}

export function useUploadSyllabus(subject) {
  return useTreeMutation(subject, (files) => syllabusService.upload(subject, files));
}
