import { ArrowLeft, KeyRound, Power, PowerOff } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Spinner,
} from '@/components/ui';
import {
  EditUserForm,
  ROLE_BADGE_VARIANT,
  useAdminUser,
  useSendPasswordReset,
  useUpdateUser,
} from '@/features/admin';
import { ROLE_LABELS, useSession } from '@/features/auth';
import { BOARDS, LANGUAGES, LEVELS, gradeLabel, labelFor } from '@/features/profile';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getApiError } from '@/utils/apiError';
import { formatDate, formatRelative } from '@/utils/format';

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function PeopleList({ title, people, empty, extra }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle as="h2">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={person.name} src={person.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/users/${person.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {person.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                </div>
                {extra?.(person)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ClassList({ title, classes, empty }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle as="h2">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {classes.map((classroom) => (
              <li key={classroom.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{classroom.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {classroom.subject}
                    {classroom.teacher ? ` · ${classroom.teacher.name}` : ''}
                  </p>
                </div>
                <Badge variant="outline">
                  {classroom.student_count} {classroom.student_count === 1 ? 'student' : 'students'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminUserDetailPage() {
  const { userId } = useParams();
  const { user: me } = useSession();
  const { data, isPending, isError, error } = useAdminUser(userId);
  const update = useUpdateUser(userId);
  const sendReset = useSendPasswordReset(userId);
  useDocumentTitle(data?.user.name);

  const backLink = (
    <Link
      to="/admin/users"
      className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-ring"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All users
    </Link>
  );

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return (
      <>
        {backLink}
        <EmptyState
          title={error?.response?.status === 404 ? 'User not found' : 'Something went wrong'}
          description="The account may have been removed."
        />
      </>
    );
  }

  const { user, student_profile: profile } = data;
  const isSelf = me?.id === user.id;

  const runAction = async (action, successMessage) => {
    try {
      await action();
      toast.success(successMessage);
    } catch (actionError) {
      toast.error(getApiError(actionError).message);
      throw actionError;
    }
  };

  return (
    <>
      {backLink}
      <Card className="mb-6 p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} src={user.avatar_url} size="lg" className="size-16 text-xl" />
            <div className="min-w-0 space-y-1.5">
              <h1 className="truncate text-xl font-bold">{user.name}</h1>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                {user.is_active ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="destructive">Deactivated</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              trigger={
                <Button variant="outline" disabled={!user.is_active}>
                  <KeyRound className="size-4" aria-hidden="true" />
                  Send reset link
                </Button>
              }
              title="Send a password reset link?"
              description={`An email with a 30-minute reset link will be sent to ${user.email}.`}
              confirmLabel="Send link"
              onConfirm={() => runAction(() => sendReset.mutateAsync(), 'Reset link sent')}
            />
            {!isSelf &&
              (user.is_active ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive">
                      <PowerOff className="size-4" aria-hidden="true" />
                      Deactivate
                    </Button>
                  }
                  title={`Deactivate ${user.name}?`}
                  description="They'll be signed out everywhere and won't be able to sign in until reactivated. Their data is kept."
                  confirmLabel="Deactivate"
                  destructive
                  onConfirm={() =>
                    runAction(() => update.mutateAsync({ is_active: false }), 'Account deactivated')
                  }
                />
              ) : (
                <Button
                  loading={update.isPending}
                  onClick={() =>
                    runAction(
                      () => update.mutateAsync({ is_active: true }),
                      'Account reactivated'
                    ).catch(() => {})
                  }
                >
                  <Power className="size-4" aria-hidden="true" />
                  Reactivate
                </Button>
              ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Account details</CardTitle>
              <CardDescription>Update the name, email or role for this account.</CardDescription>
            </CardHeader>
            <CardContent>
              <EditUserForm user={user} isSelf={isSelf} />
            </CardContent>
          </Card>

          {user.role === 'student' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <PeopleList
                title="Linked parents"
                people={data.parents}
                empty="No parents linked."
                extra={(person) => (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(person.linked_at)}
                  </span>
                )}
              />
              <ClassList
                title="Classes joined"
                classes={data.classes_enrolled}
                empty="Not in any classes."
              />
            </div>
          )}
          {user.role === 'parent' && (
            <PeopleList
              title="Linked children"
              people={data.children}
              empty="No children linked."
              extra={(child) => <Badge variant="outline">{gradeLabel(child.grade)}</Badge>}
            />
          )}
          {user.role === 'teacher' && (
            <ClassList title="Classes" classes={data.classes_taught} empty="No classes yet." />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle as="h2">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <Row label="Joined">{formatDate(user.created_at)}</Row>
                <Row label="Last sign-in">
                  {user.last_login_at ? formatRelative(user.last_login_at) : 'Never'}
                </Row>
              </dl>
            </CardContent>
          </Card>
          {profile && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle as="h2">Learning profile</CardTitle>
              </CardHeader>
              <CardContent>
                {profile.is_complete ? null : (
                  <Badge variant="warning" className="mb-2">
                    Setup incomplete
                  </Badge>
                )}
                <dl className="divide-y divide-border">
                  <Row label="Class">{gradeLabel(profile.grade)}</Row>
                  <Row label="Board">{profile.board ? labelFor(BOARDS, profile.board) : '—'}</Row>
                  <Row label="Level">
                    {profile.learning_level ? labelFor(LEVELS, profile.learning_level) : '—'}
                  </Row>
                  <Row label="Language">{labelFor(LANGUAGES, profile.preferred_language)}</Row>
                  <Row label="School">{profile.school_name || '—'}</Row>
                  <Row label="Subjects">
                    {profile.subjects.length ? profile.subjects.join(', ') : '—'}
                  </Row>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
