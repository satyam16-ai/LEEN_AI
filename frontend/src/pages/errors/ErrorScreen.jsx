import { Link } from 'react-router-dom';

import { Button, Logo } from '@/components/ui';
import { ROLE_HOME } from '@/features/auth/constants';
import { useSession } from '@/features/auth/hooks/useSession';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function ErrorScreen({ code, title, description, icon: Icon }) {
  useDocumentTitle(title);
  const { user } = useSession();

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
        aria-hidden="true"
      />
      <header className="relative flex h-16 items-center px-4 sm:px-8">
        <Link to="/" className="rounded-lg focus-ring" aria-label="LEEN AI home">
          <Logo />
        </Link>
      </header>
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
        <span className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
          <Icon className="size-8" aria-hidden="true" />
        </span>
        <p className="font-display text-sm font-bold tracking-widest text-primary">{code}</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-md text-muted-foreground">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {user ? (
            <Button asChild size="lg">
              <Link to={ROLE_HOME[user.role]}>Go to my dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
