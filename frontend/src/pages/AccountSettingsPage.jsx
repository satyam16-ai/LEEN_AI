import { Monitor, Moon, Sun } from 'lucide-react';

import { PageHeader } from '@/components/dashboard';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { ChangePasswordForm, ROLE_LABELS, useSession } from '@/features/auth';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function ProfileRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export function AccountSettingsPage() {
  const { user } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <PageHeader
        title="Account settings"
        description="Manage your profile, appearance and security."
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader className="items-center pb-2 text-center">
            <Avatar name={user.name} size="lg" className="size-16 text-xl" />
            <CardTitle as="h2" className="mt-2 text-lg">
              {user.name}
            </CardTitle>
            <Badge variant="primary" className="mx-auto">
              {ROLE_LABELS[user.role]}
            </Badge>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <ProfileRow label="Email">{user.email}</ProfileRow>
              <ProfileRow label="Member since">{formatDate(user.created_at)}</ProfileRow>
            </dl>
            <p className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              Editing your name, photo and learning preferences arrives in Phase 2.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Appearance</CardTitle>
              <CardDescription>Choose how LEEN AI looks on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={theme === value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all focus-ring',
                      theme === value
                        ? 'border-primary bg-primary-soft/60 text-primary-soft-foreground ring-4 ring-primary/10'
                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

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
        </div>
      </div>
    </>
  );
}
