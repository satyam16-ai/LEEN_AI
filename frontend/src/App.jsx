// =============================================================================
// App Entry Point
// =============================================================================

import { RouterProvider } from 'react-router-dom';
import { QueryProvider } from '@/store/query-provider';
import { router } from '@/routes';

function App() {
  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  );
}

export default App;
