import { School } from 'lucide-react';

import { PageHeader } from '@/components/dashboard';
import { EmptyState, Spinner } from '@/components/ui';
import { JoinClassCard, StudentClassCard, useMyClasses } from '@/features/classes';

export function StudentClassesPage() {
  const { data: classes, isPending, isError } = useMyClasses();

  return (
    <>
      <PageHeader title="My classes" description="Classes you've joined with a teacher's code." />
      <div className="space-y-8">
        <JoinClassCard />
        <section aria-labelledby="joined-heading">
          <h2 id="joined-heading" className="mb-4 text-lg font-bold">
            Joined classes {classes?.length ? `(${classes.length})` : ''}
          </h2>
          {isPending ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Couldn't load your classes. Try refreshing.</p>
          ) : classes.length === 0 ? (
            <EmptyState
              icon={School}
              title="You haven't joined any classes yet"
              description="Ask your teacher for their class code and enter it above."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {classes.map((classroom) => (
                <StudentClassCard key={classroom.id} classroom={classroom} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
