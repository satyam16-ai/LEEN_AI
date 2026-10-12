import { BarChart3, BookOpenText, ClipboardCheck, School, Users } from 'lucide-react';

import { FeatureCard, StatCard, WelcomeBanner } from '@/components/dashboard';
import { useSession } from '@/features/auth';

const STATS = [
  { label: 'Classes', value: 0, icon: School, tone: 'primary' },
  { label: 'Students', value: 0, icon: Users, tone: 'accent' },
  { label: 'Quizzes assigned', value: 0, icon: ClipboardCheck, tone: 'success' },
];

const TOOLS = [
  {
    icon: School,
    title: 'Classes & join codes',
    description: 'Create classes and invite students with a simple join code.',
    phase: 2,
    tone: 'primary',
  },
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

  return (
    <>
      <WelcomeBanner
        user={user}
        subtitle="Less grading, more teaching. Your classroom tools are on the way."
      />

      <section aria-label="Overview" className="mb-8 grid gap-4 sm:grid-cols-3">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section aria-labelledby="teacher-tools">
        <h2 id="teacher-tools" className="mb-4 text-lg font-bold">
          Your teaching toolkit
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <FeatureCard key={tool.title} {...tool} />
          ))}
        </div>
      </section>
    </>
  );
}
