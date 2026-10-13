import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { classroomService } from '@/services/classroomService';

export const CLASS_KEYS = {
  teaching: ['teacher', 'classes'],
  detail: (classId) => ['teacher', 'classes', classId],
  mine: ['student', 'classes'],
};

// Teacher side
export function useTeachingClasses() {
  return useQuery({ queryKey: CLASS_KEYS.teaching, queryFn: classroomService.listTeaching });
}

export function useTeacherClass(classId) {
  return useQuery({
    queryKey: CLASS_KEYS.detail(classId),
    queryFn: () => classroomService.get(classId),
    refetchOnWindowFocus: true,
  });
}

function useInvalidateTeaching() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CLASS_KEYS.teaching });
}

export function useCreateClass() {
  const invalidate = useInvalidateTeaching();
  return useMutation({ mutationFn: classroomService.create, onSuccess: invalidate });
}

export function useUpdateClass(classId) {
  const invalidate = useInvalidateTeaching();
  return useMutation({
    mutationFn: (changes) => classroomService.update(classId, changes),
    onSuccess: invalidate,
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: classroomService.remove,
    onSuccess: (_, classId) => {
      queryClient.removeQueries({ queryKey: CLASS_KEYS.detail(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.teaching });
    },
  });
}

export function useRegenerateJoinCode(classId) {
  const invalidate = useInvalidateTeaching();
  return useMutation({
    mutationFn: () => classroomService.regenerateCode(classId),
    onSuccess: invalidate,
  });
}

export function useRemoveStudent(classId) {
  const invalidate = useInvalidateTeaching();
  return useMutation({
    mutationFn: (studentId) => classroomService.removeStudent(classId, studentId),
    onSuccess: invalidate,
  });
}

// Student side
export function useMyClasses() {
  return useQuery({ queryKey: CLASS_KEYS.mine, queryFn: classroomService.listMine });
}

export function useJoinClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: classroomService.join,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLASS_KEYS.mine }),
  });
}

export function useLeaveClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: classroomService.leave,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLASS_KEYS.mine }),
  });
}
