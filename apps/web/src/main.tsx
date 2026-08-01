import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { RouterProvider } from 'react-router-dom';

import { router } from './app/router';
import { AuthProvider } from './features/auth/AuthContext';
import './styles/index.css';

/**
 * Server state is owned by TanStack Query; client state stays in Context and
 * useState (09-Frontend-Design.md section 4.1). There is no global store,
 * because nearly all state here belongs to the API.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Never retry a client error: a 401 or 403 will not succeed on a second
      // attempt, and retrying only delays the correct response to the user.
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status !== undefined && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    {/* QueryClientProvider wraps AuthProvider, not the other way round: logging
        out clears the query cache, so the auth context has to be able to reach
        the client. */}
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
