import { Badge, Card } from '@/components/ui';
import { cn } from '@/utils/cn';

const TONES = {
  primary: 'bg-primary-soft text-primary-soft-foreground',
  accent: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
};

/** A module that is planned for a later phase. */
export function FeatureCard({ icon: Icon, title, description, phase, tone = 'primary' }) {
  return (
    <Card className="group relative flex flex-col gap-4 p-5 transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex size-11 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {phase && <Badge variant="outline">Phase {phase}</Badge>}
      </div>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}
