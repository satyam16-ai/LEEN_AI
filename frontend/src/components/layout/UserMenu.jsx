import { ChevronDown, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import { ROLE_HOME, ROLE_LABELS } from '@/features/auth/constants';
import { useLogout } from '@/features/auth/hooks/useAuthMutations';
import { useSession } from '@/features/auth/hooks/useSession';

export function UserMenu() {
  const { user } = useSession();
  const logout = useLogout();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-muted focus-ring sm:pr-2"
          aria-label="Open account menu"
        >
          <Avatar name={user.name} src={user.avatar_url} size="sm" />
          <span className="hidden text-left sm:block">
            <span className="block max-w-36 truncate text-sm leading-tight font-medium">
              {user.name}
            </span>
            <span className="block text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown
            className="hidden size-4 text-muted-foreground sm:block"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <Avatar name={user.name} src={user.avatar_url} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Badge variant="primary" className="mt-2.5">
            {ROLE_LABELS[user.role]}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={ROLE_HOME[user.role]}>
            <LayoutDashboard />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/profile">
            <Settings />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
