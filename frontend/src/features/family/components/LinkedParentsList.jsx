import { UserX, Users } from 'lucide-react';
import { toast } from 'sonner';

import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Spinner,
} from '@/components/ui';
import { getApiError } from '@/utils/apiError';
import { formatDate } from '@/utils/format';

import { useLinkedParents, useRemoveParent } from '../hooks/useFamily';

export function LinkedParentsList() {
  const { data: parents, isPending, isError } = useLinkedParents();
  const removeParent = useRemoveParent();

  const remove = async (parent) => {
    try {
      await removeParent.mutateAsync(parent.id);
      toast.success(`${parent.name} can no longer see your progress`);
    } catch (error) {
      toast.error(getApiError(error).message);
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Who can see your progress</CardTitle>
        <CardDescription>Parents and guardians linked to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load linked parents.</p>
        ) : parents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No one linked yet"
            description="When a parent enters your code, they'll appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {parents.map((parent) => (
              <li key={parent.id} className="flex items-center gap-3 py-3">
                <Avatar name={parent.name} src={parent.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{parent.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {parent.email} · linked {formatDate(parent.linked_at)}
                  </p>
                </div>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm" aria-label={`Remove ${parent.name}`}>
                      <UserX className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  }
                  title={`Remove ${parent.name}?`}
                  description="They will no longer see your progress or reports. You can share a new code later to link again."
                  confirmLabel="Remove access"
                  destructive
                  onConfirm={() => remove(parent)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
