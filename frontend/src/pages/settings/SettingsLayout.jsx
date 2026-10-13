import { Palette, ShieldCheck, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { PageHeader } from '@/components/dashboard';
import { cn } from '@/utils/cn';

const TABS = [
  { to: '/settings/profile', label: 'Profile', icon: UserRound },
  { to: '/settings/security', label: 'Security', icon: ShieldCheck },
  { to: '/settings/appearance', label: 'Appearance', icon: Palette },
];

export function SettingsLayout() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, security and appearance." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings" className="flex gap-1 overflow-x-auto lg:flex-col">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-ring',
                  isActive
                    ? 'bg-primary-soft text-primary-soft-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          <Outlet />
        </div>
      </div>
    </>
  );
}
