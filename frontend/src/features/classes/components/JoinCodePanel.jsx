import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button, Card, ConfirmDialog, CopyButton } from '@/components/ui';
import { getApiError } from '@/utils/apiError';

import { useRegenerateJoinCode } from '../hooks/useClasses';

export function JoinCodePanel({ classroom }) {
  const regenerate = useRegenerateJoinCode(classroom.id);

  const onRegenerate = async () => {
    try {
      await regenerate.mutateAsync();
      toast.success('New join code generated');
    } catch (error) {
      toast.error(getApiError(error).message);
      throw error;
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="bg-brand-gradient p-6 text-center text-white">
        <p className="text-xs font-semibold tracking-widest text-white/75 uppercase">Join code</p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]" data-testid="join-code">
          {classroom.join_code}
        </p>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">
          Students open <span className="font-medium text-foreground">My classes</span> in LEEN AI
          and enter this code to join.
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={classroom.join_code} label="Copy code" />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm">
                <RefreshCw className="size-4" aria-hidden="true" />
                New code
              </Button>
            }
            title="Generate a new join code?"
            description="The current code will stop working. Students already in the class stay enrolled."
            confirmLabel="Generate new code"
            onConfirm={onRegenerate}
          />
        </div>
      </div>
    </Card>
  );
}
