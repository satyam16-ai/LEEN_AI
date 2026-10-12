import { cn } from '@/utils/cn';

export function Checkbox({ className, ...props }) {
  return (
    <input
      type="checkbox"
      className={cn(
        'size-4 shrink-0 rounded border-input accent-primary focus-ring disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
}
