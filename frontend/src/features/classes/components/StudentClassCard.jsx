import { LogOut, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, Badge, Button, Card, ConfirmDialog } from '@/components/ui';
import { getApiError } from '@/utils/apiError';
import { formatDate } from '@/utils/format';

import { useLeaveClass } from '../hooks/useClasses';

export function StudentClassCard({ classroom }) {
  const leave = useLeaveClass();

  const onLeave = async () => {
    try {
      await leave.mutateAsync(classroom.id);
      toast.success(`You left ${classroom.name}`);
    } catch (error) {
      toast.error(getApiError(error).message);
      throw error;
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-semibold">{classroom.name}</h3>
          <p className="text-sm text-muted-foreground">{classroom.subject}</p>
        </div>
        {classroom.grade && <Badge variant="primary">Class {classroom.grade}</Badge>}
      </div>
      {classroom.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{classroom.description}</p>
      )}
      <div className="flex items-center gap-2.5">
        <Avatar name={classroom.teacher.name} src={classroom.teacher.avatar_url} size="sm" />
        <div className="text-sm">
          <p className="font-medium">{classroom.teacher.name}</p>
          <p className="text-xs text-muted-foreground">Teacher</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="size-4" aria-hidden="true" />
          {classroom.student_count} {classroom.student_count === 1 ? 'student' : 'students'} ·
          joined {formatDate(classroom.joined_at)}
        </span>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Leave ${classroom.name}`}>
              <LogOut className="size-4" />
            </Button>
          }
          title={`Leave ${classroom.name}?`}
          description="You can rejoin later with the class code from your teacher."
          confirmLabel="Leave class"
          destructive
          onConfirm={onLeave}
        />
      </div>
    </Card>
  );
}
