import { Loader2 } from 'lucide-react';

import { cn } from '@/utils/cn';

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex">
      <Loader2 className={cn('size-5 animate-spin text-primary', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
