import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, RefreshCw, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  Select,
} from '@/components/ui';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { useCreateUser } from '../hooks/useAdminUsers';
import { createUserSchema, generateTemporaryPassword } from '../schemas';

const ROLE_OPTIONS = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'admin', label: 'Admin' },
];

function freshValues() {
  return { name: '', email: '', role: 'teacher', password: generateTemporaryPassword() };
}

export function CreateUserDialog({ trigger }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState(null);
  const createUser = useCreateUser();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(createUserSchema), defaultValues: freshValues() });

  const onOpenChange = (next) => {
    setOpen(next);
    if (next) {
      reset(freshValues());
      setFormError(null);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(getValues('password'));
      toast.success('Password copied');
    } catch {
      toast.error('Could not copy — select and copy it manually');
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await createUser.mutateAsync(values);
      toast.success(`${user.name}'s account is ready`, {
        description: 'Share the email and temporary password with them securely.',
      });
      setOpen(false);
    } catch (error) {
      const apiError = getApiError(error);
      if (apiError.status === 409) {
        setError('email', { type: 'server', message: apiError.message });
      } else if (!applyFieldErrors(apiError.fieldErrors, setError)) {
        setFormError(apiError.message);
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="size-4" aria-hidden="true" />
            Add user
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            Teachers can't sign up themselves — create their account here and share the temporary
            password. They can change it from Account settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Alert variant="destructive">{formError}</Alert>}

          <FormField id="new-user-role" label="Role" error={errors.role?.message}>
            <Select {...register('role')}>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="new-user-name" label="Full name" error={errors.name?.message}>
            <Input autoComplete="off" placeholder="e.g. Ravi Kumar" {...register('name')} />
          </FormField>
          <FormField id="new-user-email" label="Email" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="off"
              placeholder="teacher@school.edu"
              {...register('email')}
            />
          </FormField>
          <FormField
            id="new-user-password"
            label="Temporary password"
            error={errors.password?.message}
            hint="Auto-generated. You can also type your own."
          >
            <div className="flex gap-2">
              <Input className="font-mono" autoComplete="off" {...register('password')} />
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setValue('password', generateTemporaryPassword(), { shouldValidate: true })
                }
                aria-label="Generate a new password"
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={copyPassword}
                aria-label="Copy password"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createUser.isPending}>
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
