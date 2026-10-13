import { z } from 'zod';

import { MAX_SUBJECTS } from './constants';

export const profileDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long'),
});

export const learningProfileSchema = z.object({
  grade: z.number({ error: 'Choose your class' }).int().min(1).max(12),
  board: z.enum(['cbse', 'icse', 'state', 'ib', 'igcse', 'other'], {
    error: 'Choose your board',
  }),
  school_name: z.string().trim().max(150, 'School name is too long'),
  subjects: z
    .array(z.string())
    .min(1, 'Pick at least one subject')
    .max(MAX_SUBJECTS, `Pick up to ${MAX_SUBJECTS} subjects`),
  learning_level: z.enum(['beginner', 'intermediate', 'advanced'], {
    error: 'Choose the level that fits you best',
  }),
  preferred_language: z.enum(['en', 'hi']),
});

export function learningProfileDefaults(profile) {
  return {
    grade: profile?.grade ?? undefined,
    board: profile?.board ?? undefined,
    school_name: profile?.school_name ?? '',
    subjects: profile?.subjects ?? [],
    learning_level: profile?.learning_level ?? undefined,
    preferred_language: profile?.preferred_language ?? 'en',
  };
}
