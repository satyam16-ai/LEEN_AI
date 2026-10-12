import { Settings } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { Badge, Logo } from '@/components/ui';
import { NAVIGATION } from '@/config/navigation';
import { ROLE_HOME, ROLE_LABELS } from '@/features/auth/constants';
import { cn } from '@/utils/cn';

const itemBase =
  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring';

function navClasses({ isActive }) {
  return cn(
    itemBase,
    isActive
      ? 'bg-primary-soft text-primary-soft-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  );
}

export function AppSidebar({ role, onNavigate }) {
  const items = NAVIGATION[role] ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <Link to={ROLE_HOME[role]} onClick={onNavigate} className="rounded-lg focus-ring">
          <Logo />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pt-2 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
          {ROLE_LABELS[role]} workspace
        </p>
        {items.map(({ label, to, end, icon: Icon, phase }) =>
          to ? (
            <NavLink key={label} to={to} end={end} className={navClasses} onClick={onNavigate}>
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
            </NavLink>
          ) : (
            <span
              key={label}
              aria-disabled="true"
              title={`Coming in Phase ${phase}`}
              className={cn(itemBase, 'cursor-not-allowed text-muted-foreground/55')}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
              <Badge variant="outline" className="ml-auto px-1.5 text-[10px]">
                Soon
              </Badge>
            </span>
          )
        )}
      </nav>

      <div className="border-t border-border p-3">
        <NavLink to="/settings/account" className={navClasses} onClick={onNavigate}>
          <Settings className="size-[18px]" aria-hidden="true" />
          Account settings
        </NavLink>
      </div>
    </div>
  );
}
