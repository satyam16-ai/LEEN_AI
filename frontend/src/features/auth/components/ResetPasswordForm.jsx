import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Alert, Button, FormField, PasswordInput, PasswordStrength } from '@/components/ui';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { broadcastAuthEvent } from '../authChannel';
import { clearSession, useResetPassword } from '../hooks/useAuthMutations';
import { resetPasswordSchema } from '../schemas';

export function ResetPasswordForm({ token }) {
  const resetPassword = useResetPassword();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async ({ password: newPassword }) => {
    setFormError(null);
    try {
      const message = await resetPassword.mutateAsync({ token, password: newPassword });
      // Every session was revoked server-side, including any in this browser.
      clearSession(queryClient);
      broadcastAuthEvent('logout');
      toast.success(message);
      navigate('/login', { replace: true });
    } catch (error) {
      const apiError = getApiError(error);
      if (!applyFieldErrors(apiError.fieldErrors, setError)) setFormError(apiError.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <Alert variant="destructive">
          {formError}{' '}
          <Link to="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
        </Alert>
      )}

      <div className="space-y-3">
        <FormField id="reset-password" label="New password" error={errors.password?.message}>
          <PasswordInput
            autoComplete="new-password"
            placeholder="Create a new password"
            autoFocus
            {...register('password')}
          />
        </FormField>
        <PasswordStrength value={password} />
      </div>

      <FormField
        id="reset-confirm"
        label="Confirm new password"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          {...register('confirmPassword')}
        />
      </FormField>

      <Button type="submit" size="lg" className="w-full" loading={resetPassword.isPending}>
        Update password
      </Button>
    </form>
  );
}
