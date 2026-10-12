import { Link } from 'react-router-dom';

import { RegisterForm } from '@/features/auth';
import { AuthHeader } from '@/features/auth/components/AuthHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function RegisterPage() {
  useDocumentTitle('Create account');

  return (
    <>
      <AuthHeader
        title="Create your account"
        description="Start learning smarter — it takes less than a minute."
      />
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
