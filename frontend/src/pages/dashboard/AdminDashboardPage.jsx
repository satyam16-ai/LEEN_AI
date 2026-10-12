import {
  ArrowRight,
  GraduationCap,
  HeartHandshake,
  School,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { StatCard, WelcomeBanner } from '@/components/dashboard';
import { Button, Card, CardHeader, CardTitle, Spinner } from '@/components/ui';
import { CreateUserDialog, UsersTable, useAdminUsers } from '@/features/admin';
import { useSession } from '@/features/auth';

const ROLE_STATS = [
  { role: 'student', label: 'Students', icon: GraduationCap, tone: 'primary' },
  { role: 'parent', label: 'Parents', icon: HeartHandshake, tone: 'accent' },
  { role: 'teacher', label: 'Teachers', icon: School, tone: 'success' },
  { role: 'admin', label: 'Admins', icon: ShieldCheck, tone: 'warning' },
];

export function AdminDashboardPage() {
  const { user } = useSession();
  const { data, isPending, isError } = useAdminUsers({ page: 1, pageSize: 5 });

  return (
    <>
      <WelcomeBanner user={user} subtitle="Here's what's happening across LEEN AI today.">
        <CreateUserDialog
          trigger={
            <Button className="bg-white text-slate-900 hover:bg-white/90">
              <UserPlus className="size-4" aria-hidden="true" />
              Add teacher
            </Button>
          }
        />
      </WelcomeBanner>

      <section aria-label="Users by role" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_STATS.map(({ role, ...stat }) => (
          <StatCard key={role} {...stat} value={data?.counts?.[role] ?? 0} loading={isPending} />
        ))}
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle as="h2">Recently joined</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/users">
              View all
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        {isPending ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="px-6 pb-6 text-sm text-destructive">Couldn't load users. Try refreshing.</p>
        ) : (
          <UsersTable users={data.items} />
        )}
      </Card>
    </>
  );
}
