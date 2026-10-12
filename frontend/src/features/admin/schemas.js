import { z } from 'zod';

import { newPasswordSchema } from '@/features/auth/schemas';

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name').max(100, 'Name is too long'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.enum(['teacher', 'student', 'parent', 'admin']),
  password: newPasswordSchema,
});

/** Readable temporary password that satisfies the backend rules. */
export function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const random = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const letters = Array.from({ length: 9 }, () => random(alphabet)).join('');
  return `${letters}${random(digits)}${random(digits)}${random(digits)}`;
}
