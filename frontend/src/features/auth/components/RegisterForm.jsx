import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Input,
  PasswordInput,
  PasswordStrength,
} from '@/components/ui';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { useRegister } from '../hooks/useAuthMutations';
import { registerSchema } from '../schemas';
import { RoleSelector } from './RoleSelector';

export function RegisterForm() {
  const registerUser = useRegister();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: undefined,
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });
  const [password, role] = useWatch({ control, name: ['password', 'role'] });

  const onSubmit = handleSubmit(async ({ name, email, password: pw, role: selectedRole }) => {
    setFormError(null);
    try {
      const user = await registerUser.mutateAsync({
        name,
        email,
        password: pw,
        role: selectedRole,
      });
      toast.success(`Welcome to LEEN AI, ${user.name.split(' ')[0]}!`);
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
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="destructive">{formError}</Alert>}

      <RoleSelector registration={register('role')} error={errors.role?.message} />

      {role === 'parent' && (
        <p className="flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          After signing up you'll be able to link your child's account to see their progress.
        </p>
      )}

      <FormField id="register-name" label="Full name" error={errors.name?.message}>
        <Input autoComplete="name" placeholder="e.g. Asha Verma" {...register('name')} />
      </FormField>

      <FormField id="register-email" label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register('email')}
        />
      </FormField>

      <div className="space-y-3">
        <FormField id="register-password" label="Password" error={errors.password?.message}>
          <PasswordInput
            autoComplete="new-password"
            placeholder="Create a password"
            {...register('password')}
          />
        </FormField>
        <PasswordStrength value={password} />
      </div>

      <FormField
        id="register-confirm"
        label="Confirm password"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          autoComplete="new-password"
          placeholder="Re-enter your password"
          {...register('confirmPassword')}
        />
      </FormField>

      <div className="space-y-1.5">
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Checkbox
            className="mt-0.5"
            aria-invalid={Boolean(errors.acceptTerms) || undefined}
            {...register('acceptTerms')}
          />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        {errors.acceptTerms && (
          <p className="text-xs font-medium text-destructive">{errors.acceptTerms.message}</p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" loading={registerUser.isPending}>
        Create account
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Teachers: your school admin will create your account and share your sign-in details.
      </p>
    </form>
  );
}
