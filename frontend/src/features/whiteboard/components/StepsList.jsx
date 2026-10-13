import { ListOrdered } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/utils/cn';

import { MathText } from './MathText';

/** Every caption so far, as a numbered transcript (also the board's text alternative). */
export function StepsList({ captions }) {
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [captions.length]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          <ListOrdered className="size-4 text-primary" aria-hidden="true" />
          Steps
        </CardTitle>
      </CardHeader>
      <CardContent>
        {captions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Each step of the explanation will be listed here.
          </p>
        ) : (
          <ol
            ref={listRef}
            className="max-h-80 space-y-1 overflow-y-auto pr-1"
            aria-label="Explanation steps"
          >
            {captions.map((caption, index) => {
              const current = index === captions.length - 1;
              return (
                <li
                  // Captions can repeat, so the position is part of the key.
                  key={`${index}-${caption}`}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'flex gap-3 rounded-lg px-2.5 py-2 text-sm leading-relaxed',
                    current
                      ? 'bg-primary-soft text-primary-soft-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                      current ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    )}
                  >
                    {index + 1}
                  </span>
                  <span>
                    <MathText text={caption} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
