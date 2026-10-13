import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/utils/cn';

export function ChecklistCard({ title, description, items }) {
  const done = items.filter((item) => item.done).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="text-xs font-medium text-muted-foreground">
            {done}/{items.length} done
          </span>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-3 rounded-lg py-2">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border',
                  item.done
                    ? 'border-success bg-success text-white'
                    : 'border-dashed border-input text-transparent'
                )}
              >
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              </span>
              <span
                className={cn('flex-1 text-sm', item.done && 'text-muted-foreground line-through')}
              >
                {item.to && !item.done ? (
                  <Link
                    to={item.to}
                    className="group inline-flex items-center gap-1 rounded font-medium text-primary hover:underline focus-ring"
                  >
                    {item.label}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                ) : (
                  item.label
                )}
                <span className="sr-only">{item.done ? ' (done)' : ' (to do)'}</span>
              </span>
              {item.phase && !item.done && <Badge variant="outline">Phase {item.phase}</Badge>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
