import { z } from 'zod';

/** A doubt needs a few words, unless a photo of the question goes with it. */
export const doubtSchema = z
  .object({
    question: z.string().trim().max(500, 'Keep your doubt under 500 characters'),
    subject: z.string(),
    hasPhoto: z.boolean().optional(),
  })
  .refine((doubt) => doubt.hasPhoto || doubt.question.length >= 3, {
    message: 'Type your doubt (at least 3 characters)',
    path: ['question'],
  });
