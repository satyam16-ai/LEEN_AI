import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/dashboard';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Spinner,
} from '@/components/ui';
import {
  ClassFormDialog,
  JoinCodePanel,
  RosterTable,
  useDeleteClass,
  useTeacherClass,
} from '@/features/classes';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getApiError } from '@/utils/apiError';

export function TeacherClassDetailPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { data: classroom, isPending, isError, error } = useTeacherClass(classId);
  const deleteClass = useDeleteClass();
  useDocumentTitle(classroom?.name);

  const onDelete = async () => {
    try {
      await deleteClass.mutateAsync(classId);
      toast.success('Class deleted');
      navigate('/teacher/classes', { replace: true });
    } catch (deleteError) {
      toast.error(getApiError(deleteError).message);
      throw deleteError;
    }
  };

  const backLink = (
    <Link
      to="/teacher/classes"
      className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground focus-ring"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All classes
    </Link>
  );

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return (
      <>
        {backLink}
        <EmptyState
          title={error?.response?.status === 404 ? 'Class not found' : 'Something went wrong'}
          description="It may have been deleted, or you might not have access to it."
        />
      </>
    );
  }

  return (
    <>
      {backLink}
      <PageHeader
        title={classroom.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {classroom.subject}
            {classroom.grade && <Badge variant="primary">Class {classroom.grade}</Badge>}
          </span>
        }
        actions={
          <>
            <ClassFormDialog
              classroom={classroom}
              trigger={
                <Button variant="outline">
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </Button>
              }
            />
            <ConfirmDialog
              trigger={
                <Button variant="ghost" aria-label="Delete class">
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              }
              title={`Delete ${classroom.name}?`}
              description="All students will be removed from the class. This can't be undone."
              confirmLabel="Delete class"
              destructive
              onConfirm={onDelete}
            />
          </>
        }
      />
      {classroom.description && (
        <p className="-mt-4 mb-8 max-w-2xl text-sm text-muted-foreground">
          {classroom.description}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle as="h2">Students ({classroom.student_count})</CardTitle>
          </CardHeader>
          <RosterTable classroom={classroom} />
        </Card>
        <div className="xl:order-last">
          <JoinCodePanel classroom={classroom} />
        </div>
      </div>
    </>
  );
}
