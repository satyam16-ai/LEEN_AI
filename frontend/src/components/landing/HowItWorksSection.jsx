import { LineChart, MessagesSquare, UserPlus } from 'lucide-react';

import { SectionHeading } from './SectionHeading';

const STEPS = [
  {
    icon: UserPlus,
    title: 'Create your account',
    description:
      'Sign up as a student or parent in under a minute. Teachers are added by their school.',
  },
  {
    icon: MessagesSquare,
    title: 'Ask, practise, learn',
    description:
      'Clear doubts the moment they come up, take quick quizzes and follow your daily plan.',
  },
  {
    icon: LineChart,
    title: 'Track and improve',
    description: 'LEEN AI spots weak topics and adjusts your plan, while parents follow along.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="From first question to real progress"
        />
        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          <div
            className="absolute top-8 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 md:block"
            aria-hidden="true"
          />
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="relative flex flex-col items-center text-center">
              <span className="relative mb-6 flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-soft">
                <Icon className="size-7" aria-hidden="true" />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
              </span>
              <h3 className="mb-2 text-lg font-bold">{title}</h3>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
