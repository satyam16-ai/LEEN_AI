import { cn } from '@/utils/cn';

export const inputClasses = cn(
  'flex h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm text-foreground shadow-xs',
  'transition-[border-color,box-shadow] placeholder:text-muted-foreground/70',
  'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/15'
);
