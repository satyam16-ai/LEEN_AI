import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  MessageCircleQuestion,
  School,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { ChecklistCard, FeatureCard, StatCard, WelcomeBanner } from '@/components/dashboard';
import { Button, Card } from '@/components/ui';
import { useSession } from '@/features/auth';
import { useMyClasses } from '@/features/classes';
import { useLinkedParents } from '@/features/family';
import { gradeLabel, useProfile } from '@/features/profile';

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

function CompleteProfileCard() {
  return (
    <Card className="mb-8 flex flex-col gap-4 border-primary/30 bg-primary-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">Set up your learning profile</p>
          <p className="text-sm text-muted-foreground">
            Tell us your class, board and subjects so answers match your syllabus. Takes a minute.
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0">
        <Link to="/student/onboarding">
          Get started
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </Card>
  );
}

export function StudentDashboardPage() {
  const { user } = useSession();
  const profile = useProfile();
  const classes = useMyClasses();
  const parents = useLinkedParents();

  const learning = profile.data?.student_profile;
  const profileComplete = Boolean(learning?.is_complete);
  const classCount = classes.data?.length ?? 0;
  const parentCount = parents.data?.length ?? 0;

  return (
    <>
      <WelcomeBanner
        user={user}
        subtitle={
          profileComplete
            ? `${gradeLabel(learning.grade)} · ${learning.subjects.slice(0, 3).join(', ')}${
                learning.subjects.length > 3 ? ` +${learning.subjects.length - 3}` : ''
              }`
            : 'Your AI teacher is getting ready. Start by setting up your learning profile.'
        }
      />

      {profile.isSuccess && !profileComplete && <CompleteProfileCard />}

      <section aria-label="Your stats" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My classes"
          value={classCount}
          icon={School}
          tone="primary"
          loading={classes.isPending}
          hint={classCount ? undefined : 'Join one with a code from your teacher'}
        />
        <StatCard
          label="Parents linked"
          value={parentCount}
          icon={Users}
          tone="accent"
          loading={parents.isPending}
        />
        <StatCard label="Doubts solved" value={0} icon={MessageCircleQuestion} tone="warning" />
        <StatCard
          label="Quizzes taken"
          value={0}
          icon={ClipboardCheck}
          tone="success"
          hint="Coming in Phase 4"
        />
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
            {
              label: 'Complete your learning profile',
              done: profileComplete,
              to: '/student/onboarding',
            },
            { label: 'Join your first class', done: classCount > 0, to: '/student/classes' },
            { label: 'Link a parent', done: parentCount > 0, to: '/student/parent-access' },
            { label: 'Ask your first doubt', phase: 3 },
          ]}
        />
      </div>
    </>
  );
}
