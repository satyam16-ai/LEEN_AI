import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

import { cn } from '@/utils/cn';

const VARIANTS = {
  info: { icon: Info, classes: 'border-primary/20 bg-primary-soft text-primary-soft-foreground' },
  success: { icon: CircleCheck, classes: 'border-success/25 bg-success-soft text-success' },
  warning: { icon: TriangleAlert, classes: 'border-warning/30 bg-warning-soft text-foreground' },
  destructive: {
    icon: CircleAlert,
    classes: 'border-destructive/25 bg-destructive-soft text-destructive',
  },
};

export function Alert({ variant = 'info', title, children, className, ...props }) {
  const { icon: Icon, classes } = VARIANTS[variant];
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', classes, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
      </div>
    </div>
  );
}
