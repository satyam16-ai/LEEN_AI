import { KeyRound, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
  Spinner,
} from '@/components/ui';
import { getApiError } from '@/utils/apiError';
import { formatRelative } from '@/utils/format';

import { useLinkCode, useRegenerateLinkCode } from '../hooks/useFamily';

const STEPS = [
  'Share this code with your parent or guardian',
  'They sign in as a parent and open “My children”',
  'They enter the code — done! The code then changes automatically',
];

export function LinkCodeCard() {
  const { data, isPending, isError } = useLinkCode();
  const regenerate = useRegenerateLinkCode();

  const onRegenerate = async () => {
    try {
      await regenerate.mutateAsync();
      toast.success('New code generated. The old one no longer works.');
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle as="h2">Your parent link code</CardTitle>
            <CardDescription>Let a parent follow your progress.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 p-5 text-center">
          {isPending ? (
            <Spinner />
          ) : isError ? (
            <p className="text-sm text-destructive">Couldn't load your code. Try refreshing.</p>
          ) : (
            <>
              <p
                className="font-mono text-3xl font-bold tracking-[0.2em] text-primary-soft-foreground sm:text-4xl"
                data-testid="link-code"
              >
                {data.code}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Expires {formatRelative(data.expires_at)}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <CopyButton value={data.code} label="Copy code" />
                <Button
                  variant="ghost"
                  size="sm"
                  loading={regenerate.isPending}
                  onClick={onRegenerate}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  New code
                </Button>
              </div>
            </>
          )}
        </div>
        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
