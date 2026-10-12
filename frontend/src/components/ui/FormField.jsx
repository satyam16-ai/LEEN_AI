import { CircleAlert } from 'lucide-react';

import { cn } from '@/utils/cn';

import { FormFieldContext } from './form-field-context';
import { Label } from './Label';

export function FormField({ id, label, error, hint, labelAction, className, children }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const showHint = Boolean(hint) && !error;
  const describedBy = [error && errorId, showHint && hintId].filter(Boolean).join(' ') || undefined;

  return (
    <FormFieldContext.Provider value={{ id, invalid: Boolean(error), describedBy }}>
      <div className={cn('space-y-2', className)}>
        {(label || labelAction) && (
          <div className="flex items-center justify-between gap-2">
            {label && <Label htmlFor={id}>{label}</Label>}
            {labelAction}
          </div>
        )}
        {children}
        {showHint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="flex items-start gap-1.5 text-xs font-medium text-destructive">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </FormFieldContext.Provider>
  );
}
