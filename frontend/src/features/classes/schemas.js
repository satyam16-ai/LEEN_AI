import { z } from 'zod';

export const classSchema = z.object({
  name: z.string().trim().min(2, 'Give the class a name').max(100, 'Name is too long'),
  subject: z.string().trim().min(2, 'Enter the subject').max(60, 'Subject is too long'),
  grade: z.string(),
  description: z.string().trim().max(500, 'Keep the description under 500 characters'),
});

export function classFormValues(classroom) {
  return {
    name: classroom?.name ?? '',
    subject: classroom?.subject ?? '',
    grade: classroom?.grade ? String(classroom.grade) : '',
    description: classroom?.description ?? '',
  };
}

export function toClassPayload(values) {
  return {
    name: values.name,
    subject: values.subject,
    grade: values.grade ? Number(values.grade) : null,
    description: values.description || null,
  };
}
