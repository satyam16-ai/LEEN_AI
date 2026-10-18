import { RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button, Select } from '@/components/ui';
import { Canvas, useBoardPlayer } from '@/features/canvas';
import { SAMPLES } from '@/features/canvas/samples';

/**
 * Dev-only gallery of every board visual (route /dev/canvas, not in production builds).
 * ?sample=<id> picks a sample; &instant=1 draws it at once (for screenshots).
 */
export function CanvasGalleryPage() {
  const [params, setParams] = useSearchParams();
  const [player, board] = useBoardPlayer();
  const sample = SAMPLES.find((item) => item.id === params.get('sample')) ?? SAMPLES[0];
  const instant = params.get('instant') === '1';

  // Runs after the Canvas has attached the player (child effects run first).
  useEffect(() => {
    player.setInstant(instant);
    player.load(sample.actions);
    window.boardPlayer = player; // for poking at the board from devtools
  }, [player, sample, instant]);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Canvas gallery</h1>
        <Select
          aria-label="Sample"
          className="h-10 w-auto"
          value={sample.id}
          onChange={(event) => setParams({ sample: event.target.value })}
        >
          {SAMPLES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={() => player.replay()}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Replay
        </Button>
        <span className="text-sm text-muted-foreground">
          {sample.actions.length} commands ·{' '}
          {JSON.stringify(sample.actions).length.toLocaleString()} characters
        </span>
      </div>
      <Canvas player={player} board={board} label={sample.title} canReplay />
    </main>
  );
}
