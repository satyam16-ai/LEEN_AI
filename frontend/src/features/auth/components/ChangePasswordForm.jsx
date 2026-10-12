import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { Alert, Button, FormField, PasswordInput, PasswordStrength } from '@/components/ui';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { useChangePassword } from '../hooks/useAuthMutations';
import { changePasswordSchema } from '../schemas';

const FIELD_MAP = { current_password: 'currentPassword', new_password: 'newPassword' };
const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordForm() {
  const changePassword = useChangePassword();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY });
  const newPassword = useWatch({ control, name: 'newPassword' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const message = await changePassword.mutateAsync(values);
      reset(EMPTY);
      toast.success(message);
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.status === 400) {
        setError('currentPassword', { type: 'server', message: apiError.message });
      } else if (!applyFieldErrors(apiError.fieldErrors, setError, FIELD_MAP)) {
        setFormError(apiError.message);
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="destructive">{formError}</Alert>}

      <FormField
        id="current-password"
        label="Current password"
        error={errors.currentPassword?.message}
      >
        <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
      </FormField>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <FormField id="new-password" label="New password" error={errors.newPassword?.message}>
            <PasswordInput autoComplete="new-password" {...register('newPassword')} />
          </FormField>
          <PasswordStrength value={newPassword} />
        </div>
        <FormField
          id="confirm-new-password"
          label="Confirm new password"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          You'll stay signed in here; other devices will be signed out.
        </p>
        <Button type="submit" loading={changePassword.isPending}>
          Update password
        </Button>
      </div>
    </form>
  );
}
