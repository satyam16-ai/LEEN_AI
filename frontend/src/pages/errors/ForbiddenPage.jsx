import { ShieldX } from 'lucide-react';

import { ErrorScreen } from './ErrorScreen';

export function ForbiddenPage() {
  return (
    <ErrorScreen
      code="403"
      icon={ShieldX}
      title="You don't have access"
      description="This area is for a different type of account. Head back to your own dashboard to continue."
    />
  );
}
