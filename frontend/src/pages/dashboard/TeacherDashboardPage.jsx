import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  ClipboardCheck,
  Plus,
  School,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { FeatureCard, StatCard, WelcomeBanner } from '@/components/dashboard';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { useSession } from '@/features/auth';
import { ClassFormDialog, TeacherClassCard, useTeachingClasses } from '@/features/classes';

const TOOLS = [
  {
    icon: BookOpenText,
    title: 'Syllabus library',
    description: 'Upload notes and chapters so the AI answers from your curriculum.',
    phase: 3,
    tone: 'accent',
  },
  {
    icon: ClipboardCheck,
    title: 'Quiz builder',
    description: 'Review AI-generated questions, then assign quizzes to a class.',
    phase: 4,
    tone: 'warning',
  },
  {
    icon: BarChart3,
    title: 'Class analytics',
    description: 'Spot topics the whole class struggles with and who needs help.',
    phase: 6,
    tone: 'success',
  },
];

export function TeacherDashboardPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const { data: classes, isPending } = useTeachingClasses();
  const studentTotal = classes?.reduce((sum, item) => sum + item.student_count, 0) ?? 0;

  const createButton = (
    <ClassFormDialog
      trigger={
        <Button className="bg-white text-slate-900 hover:bg-white/90">
          <Plus className="size-4" aria-hidden="true" />
          New class
        </Button>
      }
      onSaved={(saved) => navigate(`/teacher/classes/${saved.id}`)}
    />
  );

  return (
    <>
      <WelcomeBanner
        user={user}
        subtitle="Less grading, more teaching. Manage your classes and rosters here."
      >
        {createButton}
      </WelcomeBanner>

      <section aria-label="Overview" className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Classes"
          value={classes?.length ?? 0}
          icon={School}
          tone="primary"
          loading={isPending}
        />
        <StatCard
          label="Students enrolled"
          value={studentTotal}
          icon={Users}
          tone="accent"
          loading={isPending}
        />
        <StatCard
          label="Quizzes assigned"
          value={0}
          icon={ClipboardCheck}
          tone="success"
          hint="Coming in Phase 4"
        />
      </section>

      <section aria-labelledby="classes-heading" className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="classes-heading" className="text-lg font-bold">
            Your classes
          </h2>
          {Boolean(classes?.length) && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/teacher/classes">
                View all
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
        {isPending ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : classes?.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {classes.slice(0, 3).map((classroom) => (
              <TeacherClassCard key={classroom.id} classroom={classroom} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={School}
            title="No classes yet"
            description="Create a class to get a join code you can share with students."
          />
        )}
      </section>

      <section aria-labelledby="teacher-tools">
        <h2 id="teacher-tools" className="mb-4 text-lg font-bold">
          Coming to your toolkit
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {TOOLS.map((tool) => (
            <FeatureCard key={tool.title} {...tool} />
          ))}
        </div>
      </section>
    </>
  );
}
