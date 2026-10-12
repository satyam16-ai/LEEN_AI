import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, Logo, ThemeToggle } from '@/components/ui';
import { ROLE_HOME } from '@/features/auth/constants';
import { useSession } from '@/features/auth/hooks/useSession';
import { useScrolled } from '@/hooks/useScrolled';
import { cn } from '@/utils/cn';

const LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For families & schools', href: '#roles' },
];

export function PublicNavbar() {
  const { user } = useSession();
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300',
        scrolled || open
          ? 'border-border bg-background/85 backdrop-blur-lg'
          : 'border-transparent bg-transparent'
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link to="/" className="rounded-lg focus-ring" aria-label="LEEN AI home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-ring"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <Button asChild size="sm" className="h-9">
              <Link to={ROLE_HOME[user.role]}>Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden h-9 sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="h-9">
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </nav>

      {open && (
        <div id="mobile-nav" className="border-t border-border px-4 py-3 md:hidden">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          {!user && (
            <Link
              to="/login"
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
