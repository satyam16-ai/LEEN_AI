import { Avatar, Badge } from '@/components/ui';
import { ROLE_LABELS } from '@/features/auth/constants';
import { formatDate, formatRelative } from '@/utils/format';

const ROLE_BADGE = {
  student: 'primary',
  parent: 'accent',
  teacher: 'success',
  admin: 'warning',
};

export function UsersTable({ users }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-6 py-3 font-medium">
              User
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Role
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Last sign-in
            </th>
            <th scope="col" className="px-6 py-3 text-right font-medium">
              Joined
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-muted/40">
              <td className="px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <Badge variant={ROLE_BADGE[user.role]}>{ROLE_LABELS[user.role]}</Badge>
              </td>
              <td className="px-4 py-3.5">
                {user.is_active ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                    <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                    Active
                  </span>
                ) : (
                  <Badge variant="neutral">Deactivated</Badge>
                )}
              </td>
              <td className="px-4 py-3.5 text-muted-foreground">
                {user.last_login_at ? formatRelative(user.last_login_at) : 'Never'}
              </td>
              <td className="px-6 py-3.5 text-right text-muted-foreground">
                {formatDate(user.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
