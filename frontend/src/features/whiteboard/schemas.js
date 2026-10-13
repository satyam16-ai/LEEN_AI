import { z } from 'zod';

export const doubtSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Type your doubt (at least 3 characters)')
    .max(500, 'Keep your doubt under 500 characters'),
  subject: z.string(),
});
