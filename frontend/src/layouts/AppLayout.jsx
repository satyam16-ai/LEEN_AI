import { useState } from 'react';
import { Outlet, useMatches } from 'react-router-dom';

import { AppSidebar, AppTopbar } from '@/components/layout';
import { Dialog, SheetContent } from '@/components/ui';
import { useSession } from '@/features/auth/hooks/useSession';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/** Signed-in shell: sidebar (drawer on mobile) + topbar. Nest inside RequireAuth. */
export function AppLayout() {
  const { user } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const matches = useMatches();
  const title = matches.findLast((match) => match.handle?.title)?.handle.title;
  useDocumentTitle(title);

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-sidebar lg:block">
        <AppSidebar role={user.role} />
      </aside>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent title="Navigation">
          <AppSidebar role={user.role} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Dialog>

      <div className="lg:pl-64">
        <AppTopbar title={title} onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
