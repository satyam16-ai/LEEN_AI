import { Outlet } from 'react-router-dom';

import { PublicFooter, PublicNavbar } from '@/components/layout';

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
