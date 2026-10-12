import {
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  Flame,
  MessageCircleQuestion,
  Target,
} from 'lucide-react';

import { ChecklistCard, FeatureCard, StatCard, WelcomeBanner } from '@/components/dashboard';
import { useSession } from '@/features/auth';

const STATS = [
  { label: 'Doubts solved', value: 0, icon: MessageCircleQuestion, tone: 'primary' },
  { label: 'Quizzes taken', value: 0, icon: ClipboardCheck, tone: 'accent' },
  { label: 'Study streak', value: '0 days', icon: Flame, tone: 'warning' },
  {
    label: 'Average score',
    value: '—',
    icon: Target,
    tone: 'success',
    hint: 'Appears after your first quiz',
  },
];

const TOOLS = [
  {
    icon: MessageCircleQuestion,
    title: 'Ask a doubt',
    description: 'Type, speak or snap a photo of any question and get a step-by-step answer.',
    phase: 3,
    tone: 'primary',
  },
  {
    icon: ClipboardCheck,
    title: 'Practice quizzes',
    description: 'Auto-generated quizzes on your syllabus, graded instantly with explanations.',
    phase: 4,
    tone: 'accent',
  },
  {
    icon: CalendarCheck,
    title: 'Adaptive study plan',
    description: 'A weekly plan that reshuffles itself around your exams and weak topics.',
    phase: 5,
    tone: 'warning',
  },
  {
    icon: BarChart3,
    title: 'Progress insights',
    description: 'See your strengths, weak topics and how you are improving over time.',
    phase: 6,
    tone: 'success',
  },
];

export function StudentDashboardPage() {
  const { user } = useSession();

  return (
    <>
      <WelcomeBanner
        user={user}
        subtitle="Your AI teacher is getting ready. Here's a look at everything coming to your learning space."
      />

      <section aria-label="Your stats" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="mb-4 text-lg font-bold">
            Your learning tools
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {TOOLS.map((tool) => (
              <FeatureCard key={tool.title} {...tool} />
            ))}
          </div>
        </section>

        <ChecklistCard
          title="Getting started"
          description="A few steps to set up your learning space."
          items={[
            { label: 'Create your account', done: true },
            { label: 'Complete your learning profile', phase: 2 },
            { label: 'Ask your first doubt', phase: 3 },
            { label: 'Take your first quiz', phase: 4 },
          ]}
        />
      </div>
    </>
  );
}
