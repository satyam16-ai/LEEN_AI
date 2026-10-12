import { z } from 'zod';

// Mirrors backend validation in app/schemas/user.py so most errors are caught client-side.
const email = z.string().trim().min(1, 'Email is required').email('Enter a valid email address');

export const newPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters')
  .regex(/\p{L}/u, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
});

export const registerSchema = z
  .object({
    role: z.enum(['student', 'parent'], { error: 'Choose how you will use LEEN AI' }),
    name: z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long'),
    email,
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.literal(true, { error: 'Please accept the terms to continue' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: "Passwords don't match",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: "Passwords don't match",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: "Passwords don't match",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });
