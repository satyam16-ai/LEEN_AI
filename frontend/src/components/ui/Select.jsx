import { ChevronDown } from 'lucide-react';

import { cn } from '@/utils/cn';

import { useFormField } from './form-field-context';
import { inputClasses } from './styles';

/** Native select styled like Input — accessible and mobile-friendly by default. */
export function Select({ className, id, children, ...props }) {
  const field = useFormField();
  return (
    <div className="relative">
      <select
        id={id ?? field?.id}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        className={cn(inputClasses, 'appearance-none pr-10', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}
