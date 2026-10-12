import { Card } from '@/components/ui';
import { cn } from '@/utils/cn';

const TONES = {
  primary: 'bg-primary-soft text-primary-soft-foreground',
  accent: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'primary', loading = false }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <span className="block h-8 w-14 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="font-display text-3xl font-bold tracking-tight">{value}</p>
          )}
        </div>
        {Icon && (
          <span className={cn('flex size-10 items-center justify-center rounded-xl', TONES[tone])}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
      {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
