import { Link } from 'react-router-dom';

import { LoginForm } from '@/features/auth';
import { AuthHeader } from '@/features/auth/components/AuthHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function LoginPage() {
  useDocumentTitle('Sign in');

  return (
    <>
      <AuthHeader title="Welcome back" description="Sign in to continue learning with LEEN AI." />
      <LoginForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to LEEN AI?{' '}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
