import { History, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Spinner,
} from '@/components/ui';
import { getApiError } from '@/utils/apiError';
import { cn } from '@/utils/cn';
import { formatRelative } from '@/utils/format';

import { useDeleteDoubt, useDoubts } from '../hooks/useDoubts';
import { MathText } from './MathText';

const STATUS_BADGE = {
  failed: { label: 'Incomplete', variant: 'warning' },
  streaming: { label: 'In progress', variant: 'primary' },
};

export function DoubtHistory({ activeId, onDeleted }) {
  const { data: doubts, isPending, isError } = useDoubts();
  const deleteDoubt = useDeleteDoubt();

  const remove = async (doubt) => {
    try {
      await deleteDoubt.mutateAsync(doubt.id);
      toast.success('Doubt deleted');
      onDeleted?.(doubt.id);
    } catch (error) {
      toast.error(getApiError(error).message);
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          <History className="size-4 text-primary" aria-hidden="true" />
          Your doubts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load your doubts. Try refreshing.</p>
        ) : doubts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Doubts you ask are saved here so you can watch them again.
          </p>
        ) : (
          <ul className="-mx-2 max-h-96 space-y-0.5 overflow-y-auto">
            {doubts.map((doubt) => {
              const badge = STATUS_BADGE[doubt.status];
              const active = doubt.id === activeId;
              return (
                <li key={doubt.id} className="group relative">
                  <Link
                    to={`/student/doubts/${doubt.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg py-2 pr-10 pl-2.5 transition-colors focus-ring',
                      active ? 'bg-primary-soft' : 'hover:bg-muted'
                    )}
                  >
                    <p className="line-clamp-2 text-sm font-medium">
                      <MathText text={doubt.question} />
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {doubt.subject && <span>{doubt.subject} ·</span>}
                      <span>{formatRelative(doubt.created_at)}</span>
                      {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                    </p>
                  </Link>
                  <div className="absolute top-1.5 right-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Delete this doubt">
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      }
                      title="Delete this doubt?"
                      description="Its whiteboard explanation will be removed. This can't be undone."
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => remove(doubt)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
