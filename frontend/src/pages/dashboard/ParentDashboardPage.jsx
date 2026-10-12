import { BellRing, FileText, Link2, TrendingDown, UserPlus } from 'lucide-react';

import { FeatureCard, WelcomeBanner } from '@/components/dashboard';
import { Badge, Button, Card } from '@/components/ui';
import { useSession } from '@/features/auth';

const STEPS = [
  'Your child signs up for a student account',
  'They share their link code from their profile',
  'Enter the code here to see their progress',
];

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

  return (
    <>
      <WelcomeBanner
        user={user}
        subtitle="Stay close to your child's learning journey — without hovering."
      />

      <Card className="mb-8 overflow-hidden">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center sm:p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Link2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold">Link your child's account</h2>
                <p className="text-sm text-muted-foreground">
                  Connect to their student account to unlock reports and insights.
                </p>
              </div>
            </div>
            <ol className="grid gap-3 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 rounded-xl bg-muted/60 p-3.5 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary shadow-xs">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Button disabled>
              <UserPlus className="size-4" aria-hidden="true" />
              Link a child
            </Button>
            <Badge variant="outline">Available in Phase 2</Badge>
          </div>
        </div>
      </Card>

      <section aria-labelledby="parent-tools">
        <h2 id="parent-tools" className="mb-4 text-lg font-bold">
          What you'll be able to see
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
