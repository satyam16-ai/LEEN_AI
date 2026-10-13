import { Link2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CodeEntryForm } from '@/components/ui';
import { getApiError } from '@/utils/apiError';

import { useLinkChild } from '../hooks/useFamily';

export function LinkChildCard({ compact = false }) {
  const linkChild = useLinkChild();

  const submit = async (code) => {
    try {
      const child = await linkChild.mutateAsync(code);
      toast.success(`${child.name} is now linked to your account`);
    } catch (error) {
      throw new Error(getApiError(error).message, { cause: error });
    }
  };

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Link2 className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-bold">Link a child</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {compact
                ? 'Enter the 8-character code from your child’s “Parent access” page.'
                : 'Ask your child to open “Parent access” in their LEEN AI account and read you their 8-character code.'}
            </p>
          </div>
        </div>
        <div className="lg:min-w-[26rem]">
          <CodeEntryForm
            label="Child's link code"
            placeholder="XXXX-XXXX"
            length={8}
            groupSize={4}
            submitLabel="Link child"
            pending={linkChild.isPending}
            onSubmit={submit}
          />
        </div>
      </div>
    </Card>
  );
}
