import { Link, useSearchParams } from 'react-router-dom';

import { Alert, Button } from '@/components/ui';
import { ResetPasswordForm } from '@/features/auth';
import { AuthHeader } from '@/features/auth/components/AuthHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function ResetPasswordPage() {
  useDocumentTitle('Set a new password');
  const [params] = useSearchParams();
  const token = params.get('token');

  if (!token) {
    return (
      <>
        <AuthHeader title="Reset link missing" />
        <Alert variant="warning" className="mb-6">
          This page needs the link from your password reset email. Request a new one below.
        </Alert>
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">Request a reset link</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        title="Set a new password"
        description="Choose a strong password you don't use anywhere else."
      />
      <ResetPasswordForm token={token} />
    </>
  );
}
