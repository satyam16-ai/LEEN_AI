import { PageHeader } from '@/components/dashboard';
import { LinkCodeCard, LinkedParentsList } from '@/features/family';

export function StudentParentAccessPage() {
  return (
    <>
      <PageHeader
        title="Parent access"
        description="Share your code so a parent or guardian can follow your progress."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <LinkCodeCard />
        <LinkedParentsList />
      </div>
    </>
  );
}
