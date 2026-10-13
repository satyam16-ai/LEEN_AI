import { UsersRound } from 'lucide-react';

import { PageHeader } from '@/components/dashboard';
import { EmptyState, Spinner } from '@/components/ui';
import { ChildCard, LinkChildCard, useChildren } from '@/features/family';

export function ParentChildrenPage() {
  const { data: children, isPending, isError } = useChildren();

  return (
    <>
      <PageHeader
        title="My children"
        description="Link your child's account to follow their learning."
      />
      <div className="space-y-8">
        <LinkChildCard />
        <section aria-labelledby="children-heading">
          <h2 id="children-heading" className="mb-4 text-lg font-bold">
            Linked children {children?.length ? `(${children.length})` : ''}
          </h2>
          {isPending ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Couldn't load your children. Try refreshing.</p>
          ) : children.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No children linked yet"
              description="Enter your child's 8-character code above to see their profile and progress."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {children.map((child) => (
                <ChildCard key={child.id} child={child} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
