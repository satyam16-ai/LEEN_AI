import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { ChangePasswordForm } from '@/features/auth';

export function SecuritySettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Change password</CardTitle>
        <CardDescription>
          Use at least 8 characters with a mix of letters and numbers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm />
      </CardContent>
    </Card>
  );
}
