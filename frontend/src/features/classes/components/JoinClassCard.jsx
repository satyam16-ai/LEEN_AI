import { School } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CodeEntryForm } from '@/components/ui';
import { getApiError } from '@/utils/apiError';

import { useJoinClass } from '../hooks/useClasses';

export function JoinClassCard() {
  const join = useJoinClass();

  const submit = async (code) => {
    try {
      const joined = await join.mutateAsync(code);
      toast.success(`You joined ${joined.name}`);
    } catch (error) {
      throw new Error(getApiError(error).message, { cause: error });
    }
  };

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
            <School className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">Join a class</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Enter the 6-character code your teacher shared with you.
            </p>
          </div>
        </div>
        <div className="lg:min-w-[24rem]">
          <CodeEntryForm
            label="Class code"
            placeholder="ABC123"
            length={6}
            submitLabel="Join class"
            pending={join.isPending}
            onSubmit={submit}
          />
        </div>
      </div>
    </Card>
  );
}
