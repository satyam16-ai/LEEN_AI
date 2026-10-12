import { TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { ErrorScreen } from './ErrorScreen';
import { NotFoundPage } from './NotFoundPage';

export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <ErrorScreen
      code="Error"
      icon={TriangleAlert}
      title="Something went wrong"
      description="An unexpected error occurred. Try refreshing the page — if it keeps happening, let us know."
    />
  );
}
