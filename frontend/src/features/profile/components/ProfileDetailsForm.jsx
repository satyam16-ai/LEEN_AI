import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button, FormField, Input } from '@/components/ui';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { useUpdateProfile } from '../hooks/useProfile';
import { profileDetailsSchema } from '../schemas';

export function ProfileDetailsForm({ user }) {
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(profileDetailsSchema), values: { name: user.name } });

  const onSubmit = handleSubmit(async ({ name }) => {
    try {
      const profile = await update.mutateAsync({ name });
      reset({ name: profile.user.name });
      toast.success('Profile updated');
    } catch (error) {
      const apiError = getApiError(error);
      if (!applyFieldErrors(apiError.fieldErrors, setError)) toast.error(apiError.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="profile-name" label="Full name" error={errors.name?.message}>
          <Input autoComplete="name" {...register('name')} />
        </FormField>
        <FormField
          id="profile-email"
          label="Email"
          hint="Contact an admin if you need to change your email."
        >
          <Input value={user.email} readOnly disabled />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
