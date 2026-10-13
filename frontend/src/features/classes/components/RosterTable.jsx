import { UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, Button, ConfirmDialog, EmptyState } from '@/components/ui';
import { gradeLabel } from '@/features/profile/constants';
import { getApiError } from '@/utils/apiError';
import { formatDate } from '@/utils/format';

import { useRemoveStudent } from '../hooks/useClasses';

export function RosterTable({ classroom }) {
  const removeStudent = useRemoveStudent(classroom.id);

  const remove = async (student) => {
    try {
      await removeStudent.mutateAsync(student.id);
      toast.success(`${student.name} was removed from the class`);
    } catch (error) {
      toast.error(getApiError(error).message);
      throw error;
    }
  };

  if (classroom.students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No students yet"
        description={`Share the join code ${classroom.join_code} with your students to get started.`}
        className="m-6"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-6 py-3 font-medium">
              Student
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Class
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Joined
            </th>
            <th scope="col" className="px-6 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {classroom.students.map((student) => (
            <tr key={student.id} className="hover:bg-muted/40">
              <td className="px-6 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={student.name} src={student.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{student.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{gradeLabel(student.grade)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(student.joined_at)}</td>
              <td className="px-6 py-3 text-right">
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm" aria-label={`Remove ${student.name}`}>
                      <UserMinus className="size-4" aria-hidden="true" />
                    </Button>
                  }
                  title={`Remove ${student.name}?`}
                  description="They'll lose access to this class. They can rejoin with the join code."
                  confirmLabel="Remove student"
                  destructive
                  onConfirm={() => remove(student)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
