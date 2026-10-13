import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card } from '@/components/ui';
import { cn } from '@/utils/cn';

const TONES = {
  primary: 'bg-primary-soft text-primary-soft-foreground',
  accent: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
};

/** A learning tool: a link when it is live (`to`), or a "Phase N" teaser when planned. */
export function FeatureCard({ icon: Icon, title, description, phase, tone = 'primary', to }) {
  return (
    <Card
      className={cn(
        'group relative flex flex-col gap-4 p-5 transition-shadow hover:shadow-elevated',
        to && 'focus-within:ring-2 focus-within:ring-ring'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex size-11 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {phase && !to && <Badge variant="outline">Phase {phase}</Badge>}
        {to && <Badge variant="success">New</Badge>}
      </div>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold">
          {to ? (
            // The stretched link makes the whole card clickable.
            <Link to={to} className="outline-none after:absolute after:inset-0 after:rounded-xl">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {to && (
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
          Open
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      )}
    </Card>
  );
}
