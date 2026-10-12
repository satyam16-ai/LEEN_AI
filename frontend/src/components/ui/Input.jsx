import { cn } from '@/utils/cn';

import { useFormField } from './form-field-context';
import { inputClasses } from './styles';

export function Input({ className, id, ...props }) {
  const field = useFormField();
  return (
    <input
      id={id ?? field?.id}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={field?.describedBy}
      className={cn(inputClasses, className)}
      {...props}
    />
  );
}
