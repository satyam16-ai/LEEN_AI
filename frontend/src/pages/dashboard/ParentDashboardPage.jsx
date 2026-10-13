import { ArrowRight, BellRing, FileText, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

import { FeatureCard, WelcomeBanner } from '@/components/dashboard';
import { Button, Spinner } from '@/components/ui';
import { useSession } from '@/features/auth';
import { ChildCard, LinkChildCard, useChildren } from '@/features/family';

const FEATURES = [
  {
    icon: FileText,
    title: 'Progress reports',
    description: 'Weekly summaries of what your child studied, quiz scores and time spent.',
    phase: 7,
    tone: 'primary',
  },
  {
    icon: TrendingDown,
    title: 'Weak-topic alerts',
    description: 'Know early when a topic needs more attention — and what the plan is.',
    phase: 6,
    tone: 'warning',
  },
  {
    icon: BellRing,
    title: 'Notifications',
    description: 'Gentle nudges about missed study sessions and upcoming assessments.',
    phase: 7,
    tone: 'accent',
  },
];

export function ParentDashboardPage() {
  const { user } = useSession();
  const { data: children, isPending } = useChildren();
  const hasChildren = Boolean(children?.length);

  return (
    <>
      <WelcomeBanner
        user={user}
        subtitle={
          hasChildren
            ? `You're following ${children.length} ${children.length === 1 ? 'child' : 'children'}.`
            : "Stay close to your child's learning journey — without hovering."
        }
      />

      {isPending ? (
        <div className="mb-8 flex justify-center py-10">
          <Spinner />
        </div>
      ) : hasChildren ? (
        <section aria-labelledby="children-heading" className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="children-heading" className="text-lg font-bold">
              Your children
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/parent/children">
                Manage
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {children.map((child) => (
              <ChildCard key={child.id} child={child} />
            ))}
          </div>
        </section>
      ) : (
        <div className="mb-8">
          <LinkChildCard />
        </div>
      )}

      <section aria-labelledby="parent-tools">
        <h2 id="parent-tools" className="mb-4 text-lg font-bold">
          Coming soon for parents
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>
    </>
  );
}
