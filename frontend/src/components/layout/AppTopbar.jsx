import { Menu } from 'lucide-react';

import { Button, ThemeToggle } from '@/components/ui';

import { UserMenu } from './UserMenu';

export function AppTopbar({ title, onOpenMenu }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>
      {title && <p className="truncate text-sm font-semibold text-foreground">{title}</p>}
      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
