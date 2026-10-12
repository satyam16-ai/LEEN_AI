import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';

import { cn } from '@/utils/cn';

const VARIANTS = {
  primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
  secondary:
    'bg-primary-soft text-primary-soft-foreground hover:brightness-95 dark:hover:brightness-110',
  outline: 'border border-input bg-card text-foreground shadow-xs hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-white shadow-sm hover:brightness-95',
  link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
};

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-md px-3 text-sm',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-6 text-base',
  icon: 'size-10 rounded-lg',
  'icon-sm': 'size-8 rounded-md',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  asChild = false,
  loading = false,
  disabled,
  type,
  children,
  ...props
}) {
  const classes = cn(
    'inline-flex items-center justify-center font-medium whitespace-nowrap transition-all focus-ring',
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0',
    VARIANTS[variant],
    variant !== 'link' && SIZES[size],
    className
  );

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
