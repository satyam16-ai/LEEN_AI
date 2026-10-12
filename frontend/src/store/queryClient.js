import { QueryClient } from '@tanstack/react-query';

function shouldRetry(failureCount, error) {
  const status = error?.response?.status;
  // Retry only transient failures: network errors and 5xx.
  if (status && status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
