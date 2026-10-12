import { Check, GraduationCap, HeartHandshake } from 'lucide-react';

import { cn } from '@/utils/cn';

const OPTIONS = [
  {
    value: 'student',
    title: 'Student',
    description: 'Ask doubts, practise and follow a study plan',
    icon: GraduationCap,
  },
  {
    value: 'parent',
    title: 'Parent',
    description: "Follow your child's progress and reports",
    icon: HeartHandshake,
  },
];

export function RoleSelector({ registration, error }) {
  return (
    <fieldset className="space-y-2.5" aria-describedby={error ? 'role-error' : undefined}>
      <legend className="mb-2.5 text-sm font-medium text-foreground">I'm joining as a…</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ value, title, description, icon: Icon }) => (
          <label key={value} className="relative block">
            <input type="radio" value={value} className="peer sr-only" {...registration} />
            <div
              className={cn(
                'flex h-full cursor-pointer gap-3 rounded-xl border border-border bg-card p-4 transition-all',
                'hover:border-primary/40 hover:bg-muted/50',
                'peer-checked:border-primary peer-checked:bg-primary-soft/60 peer-checked:ring-4 peer-checked:ring-primary/10',
                'peer-focus-visible:ring-4 peer-focus-visible:ring-ring/25',
                error && 'border-destructive/60'
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="space-y-0.5 pr-5">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {description}
                </span>
              </span>
            </div>
            <span className="pointer-events-none absolute top-3 right-3 flex size-5 items-center justify-center rounded-full border border-input bg-card text-primary-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary">
              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id="role-error" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
