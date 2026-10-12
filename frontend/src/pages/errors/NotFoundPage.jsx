import { Compass } from 'lucide-react';

import { ErrorScreen } from './ErrorScreen';

export function NotFoundPage() {
  return (
    <ErrorScreen
      code="404"
      icon={Compass}
      title="Page not found"
      description="The page you're looking for doesn't exist or may have moved."
    />
  );
}
