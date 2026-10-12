import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Alert, Button, Checkbox, FormField, Input, PasswordInput } from '@/components/ui';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { useLogin } from '../hooks/useAuthMutations';
import { loginSchema } from '../schemas';

export function LoginForm() {
  const login = useLogin();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login.mutateAsync(values);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
    } catch (error) {
      const apiError = getApiError(error);
      if (!applyFieldErrors(apiError.fieldErrors, setError)) setFormError(apiError.message);
      if (apiError.status === 401) resetField('password');
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert variant="destructive">{formError}</Alert>}

      <FormField id="login-email" label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          autoFocus
          {...register('email')}
        />
      </FormField>

      <FormField
        id="login-password"
        label="Password"
        error={errors.password?.message}
        labelAction={
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary hover:underline focus-ring rounded"
          >
            Forgot password?
          </Link>
        }
      >
        <PasswordInput
          autoComplete="current-password"
          placeholder="Enter your password"
          {...register('password')}
        />
      </FormField>

      <label className="flex w-fit items-center gap-2.5 text-sm text-muted-foreground">
        <Checkbox {...register('rememberMe')} />
        Keep me signed in for 30 days
      </label>

      <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
        Sign in
      </Button>
    </form>
  );
}
