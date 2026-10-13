import { School, Unlink } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, Badge, Button, Card, ConfirmDialog } from '@/components/ui';
import { BOARDS, gradeLabel, labelFor } from '@/features/profile/constants';
import { getApiError } from '@/utils/apiError';
import { formatDate } from '@/utils/format';

import { useUnlinkChild } from '../hooks/useFamily';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export function ChildCard({ child }) {
  const unlink = useUnlinkChild();

  const onUnlink = async () => {
    try {
      await unlink.mutateAsync(child.id);
      toast.success(`${child.name} has been unlinked`);
    } catch (error) {
      toast.error(getApiError(error).message);
      throw error;
    }
  };

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-4">
        <Avatar name={child.name} src={child.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{child.name}</p>
          <p className="truncate text-sm text-muted-foreground">{child.email}</p>
          <div className="mt-2">
            {child.profile_complete ? (
              <Badge variant="success">Profile complete</Badge>
            ) : (
              <Badge variant="warning">Profile setup pending</Badge>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4">
        <Detail label="Class">{gradeLabel(child.grade)}</Detail>
        <Detail label="Board">{child.board ? labelFor(BOARDS, child.board) : '—'}</Detail>
        <Detail label="Classes joined">{child.class_count}</Detail>
        <Detail label="Linked since">{formatDate(child.linked_at)}</Detail>
      </dl>

      {child.school_name && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <School className="size-4 shrink-0" aria-hidden="true" />
          {child.school_name}
        </p>
      )}

      <div className="mt-auto flex justify-end border-t border-border pt-4">
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm">
              <Unlink className="size-4" aria-hidden="true" />
              Unlink
            </Button>
          }
          title={`Unlink ${child.name}?`}
          description="You'll stop seeing their progress. They can share a new code to link again."
          confirmLabel="Unlink"
          destructive
          onConfirm={onUnlink}
        />
      </div>
    </Card>
  );
}
