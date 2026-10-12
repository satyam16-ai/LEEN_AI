import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster, toast } from 'sonner';

import { AUTH_QUERY_KEY, clearSession, subscribeToAuthEvents } from '@/features/auth';
import { useTheme } from '@/hooks/useTheme';
import { router } from '@/routes';
import { setSessionExpiredHandler } from '@/services/api';
import { queryClient } from '@/store/queryClient';
import { ThemeProvider } from '@/store/ThemeProvider';

function useAuthLifecycle() {
  useEffect(() => {
    setSessionExpiredHandler(() => {
      const wasSignedIn = Boolean(queryClient.getQueryData(AUTH_QUERY_KEY));
      clearSession(queryClient);
      if (wasSignedIn) toast.info('Your session has expired. Please sign in again.');
    });

    return subscribeToAuthEvents((type) => {
      if (type === 'logout') clearSession(queryClient);
      if (type === 'login') queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    });
  }, []);
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} position="bottom-right" richColors closeButton />;
}

export function App() {
  useAuthLifecycle();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
        <ThemedToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
