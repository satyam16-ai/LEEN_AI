import { cn } from '@/utils/cn';

import { useFormField } from './form-field-context';
import { inputClasses } from './styles';

export function Textarea({ className, id, rows = 3, ...props }) {
  const field = useFormField();
  return (
    <textarea
      id={id ?? field?.id}
      rows={rows}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={field?.describedBy}
      className={cn(inputClasses, 'h-auto resize-y py-2.5', className)}
      {...props}
    />
  );
}
