import { Plus, School } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/dashboard';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { ClassFormDialog, TeacherClassCard, useTeachingClasses } from '@/features/classes';

export function TeacherClassesPage() {
  const { data: classes, isPending, isError } = useTeachingClasses();
  const navigate = useNavigate();

  const createButton = (
    <ClassFormDialog
      trigger={
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          New class
        </Button>
      }
      onSaved={(saved) => navigate(`/teacher/classes/${saved.id}`)}
    />
  );

  return (
    <>
      <PageHeader
        title="Classes"
        description="Create classes and share join codes with your students."
        actions={createButton}
      />
      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn't load your classes. Try refreshing.</p>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={School}
          title="Create your first class"
          description="Each class gets a join code. Share it and students appear on your roster."
          action={createButton}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((classroom) => (
            <TeacherClassCard key={classroom.id} classroom={classroom} />
          ))}
        </div>
      )}
    </>
  );
}
