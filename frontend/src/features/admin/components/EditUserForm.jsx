import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button, FormField, Input, Select } from '@/components/ui';
import { ROLE_LABELS } from '@/features/auth/constants';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { useUpdateUser } from '../hooks/useAdminUsers';
import { editUserSchema } from '../schemas';

export function EditUserForm({ user, isSelf }) {
  const update = useUpdateUser(user.id);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, dirtyFields },
  } = useForm({
    resolver: zodResolver(editUserSchema),
    values: { name: user.name, email: user.email, role: user.role },
  });

  const onSubmit = handleSubmit(async (values) => {
    const changes = Object.fromEntries(
      Object.keys(dirtyFields).map((field) => [field, values[field]])
    );
    try {
      const saved = await update.mutateAsync(changes);
      reset({ name: saved.name, email: saved.email, role: saved.role });
      toast.success(
        changes.role ? 'User updated — they will need to sign in again' : 'User updated'
      );
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.status === 409 && apiError.message.toLowerCase().includes('email')) {
        setError('email', { type: 'server', message: apiError.message });
      } else if (!applyFieldErrors(apiError.fieldErrors, setError)) {
        toast.error(apiError.message);
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="edit-name" label="Full name" error={errors.name?.message}>
          <Input {...register('name')} />
        </FormField>
        <FormField id="edit-email" label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </FormField>
      </div>
      <FormField
        id="edit-role"
        label="Role"
        error={errors.role?.message}
        hint={
          isSelf
            ? "You can't change your own role."
            : 'Changing the role signs the user out of every device.'
        }
      >
        <Select disabled={isSelf} {...register('role')}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
