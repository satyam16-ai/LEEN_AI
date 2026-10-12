import { ForgotPasswordForm } from '@/features/auth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  return <ForgotPasswordForm />;
}
