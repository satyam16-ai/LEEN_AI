// =============================================================================
// Root Layout — Navbar + Footer wrapper for all pages
// =============================================================================

import { Outlet } from 'react-router-dom';
import { Navbar, Footer } from '@/components/layout';

export function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col gradient-bg text-white">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
