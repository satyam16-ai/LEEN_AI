import { cn } from '@/utils/cn';

const VARIANTS = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  accent: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-foreground',
  destructive: 'bg-destructive-soft text-destructive',
  outline: 'border border-border text-muted-foreground',
};

export function Badge({ variant = 'neutral', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
