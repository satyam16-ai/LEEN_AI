import {
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  HeartHandshake,
  MessageCircleQuestion,
  ShieldCheck,
} from 'lucide-react';

import { cn } from '@/utils/cn';

import { SectionHeading } from './SectionHeading';

const FEATURES = [
  {
    icon: MessageCircleQuestion,
    title: 'Instant doubt solving',
    description:
      'Type, speak or snap a photo of a question. Get clear, step-by-step answers grounded in your syllabus.',
    tone: 'bg-primary-soft text-primary-soft-foreground',
  },
  {
    icon: CalendarCheck,
    title: 'Adaptive study planner',
    description:
      'A personal timetable that reshuffles itself around exams, progress and the topics you find hard.',
    tone: 'bg-accent-soft text-accent-soft-foreground',
  },
  {
    icon: ClipboardCheck,
    title: 'Quizzes & auto-grading',
    description:
      'Practice quizzes generated for each chapter, graded instantly with explanations for every answer.',
    tone: 'bg-warning-soft text-warning',
  },
  {
    icon: BarChart3,
    title: 'Performance analytics',
    description:
      'Spot weak areas early with mastery scores per topic and personalised recommendations.',
    tone: 'bg-success-soft text-success',
  },
  {
    icon: HeartHandshake,
    title: 'Parent monitoring',
    description:
      'Parents see progress, reports and alerts — so they can support without second-guessing.',
    tone: 'bg-primary-soft text-primary-soft-foreground',
  },
  {
    icon: ShieldCheck,
    title: 'Safe & private',
    description:
      'Separate, role-based spaces for students, parents and teachers, with secure sign-in throughout.',
    tone: 'bg-accent-soft text-accent-soft-foreground',
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="scroll-mt-20 border-y border-border bg-card/40 py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="features-heading"
          eyebrow="Features"
          title="Everything a great tutor does — on demand"
          description="One platform for learning, practice and progress, built around how each student learns."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, tone }) => (
            <article
              key={title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <span
                className={cn('mb-5 flex size-12 items-center justify-center rounded-xl', tone)}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mb-2 text-lg font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
