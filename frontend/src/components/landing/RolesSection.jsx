import { Check, GraduationCap, HeartHandshake, School } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';

import { SectionHeading } from './SectionHeading';

const ROLES = [
  {
    icon: GraduationCap,
    title: 'For students',
    points: ['24×7 doubt solving', 'Quizzes with instant feedback', 'A plan that adapts to you'],
    cta: { label: 'Join as a student', to: '/register' },
    highlight: true,
  },
  {
    icon: HeartHandshake,
    title: 'For parents',
    points: ["See your child's progress", 'Weekly reports and alerts', 'Know where they need help'],
    cta: { label: 'Join as a parent', to: '/register' },
  },
  {
    icon: School,
    title: 'For teachers',
    points: ['Less time grading', 'Class-wide weak-topic insights', 'Assign AI-built quizzes'],
    note: 'Teacher accounts are created by your school admin.',
  },
];

export function RolesSection() {
  return (
    <section
      id="roles"
      aria-labelledby="roles-heading"
      className="scroll-mt-20 border-t border-border bg-card/40 py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="roles-heading"
          eyebrow="Built for everyone in the journey"
          title="One platform. Three perspectives."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {ROLES.map(({ icon: Icon, title, points, cta, note, highlight }) => (
            <article
              key={title}
              className={cn(
                'flex flex-col rounded-2xl border bg-card p-7 shadow-soft',
                highlight ? 'border-primary/40 ring-4 ring-primary/10' : 'border-border'
              )}
            >
              <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mb-4 text-xl font-bold">{title}</h3>
              <ul className="mb-7 flex-1 space-y-3">
                {points.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm">
                    <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              {cta ? (
                <Button asChild variant={highlight ? 'primary' : 'outline'} className="w-full">
                  <Link to={cta.to}>{cta.label}</Link>
                </Button>
              ) : (
                <p className="rounded-lg bg-muted px-3 py-2.5 text-center text-xs text-muted-foreground">
                  {note}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
