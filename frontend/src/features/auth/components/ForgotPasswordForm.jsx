import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { Alert, Button, FormField, Input } from '@/components/ui';
import { getApiError } from '@/utils/apiError';

import { useForgotPassword } from '../hooks/useAuthMutations';
import { AuthHeader } from './AuthHeader';
import { forgotPasswordSchema } from '../schemas';

export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const [sentTo, setSentTo] = useState(null);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const send = async ({ email }) => {
    setFormError(null);
    try {
      await forgotPassword.mutateAsync({ email });
      setSentTo(email);
    } catch (error) {
      setFormError(getApiError(error).message);
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-success-soft text-success">
          <MailCheck className="size-7" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Check your inbox</h2>
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{sentTo}</span>,
            we've sent a link to reset your password. It expires in 30 minutes.
          </p>
        </div>
        {formError && <Alert variant="destructive">{formError}</Alert>}
        {import.meta.env.DEV && (
          <Alert variant="info">
            Development: emails are captured by Mailpit at{' '}
            <a
              className="font-medium underline"
              href="http://localhost:8025"
              target="_blank"
              rel="noreferrer"
            >
              localhost:8025
            </a>
            .
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <Button asChild size="lg">
            <Link to="/login">Back to sign in</Link>
          </Button>
          <Button
            variant="ghost"
            loading={forgotPassword.isPending}
            onClick={() => send({ email: getValues('email') })}
          >
            Didn't get it? Send again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthHeader
        title="Forgot your password?"
        description="Enter the email you signed up with and we'll send you a reset link."
      />
      <form onSubmit={handleSubmit(send)} noValidate className="space-y-5">
        {formError && <Alert variant="destructive">{formError}</Alert>}
        <FormField id="forgot-email" label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            autoFocus
            {...register('email')}
          />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={forgotPassword.isPending}>
          Send reset link
        </Button>
        <Link
          to="/login"
          className="mx-auto flex w-fit items-center gap-1.5 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </form>
    </>
  );
}
