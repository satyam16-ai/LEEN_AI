import { cn } from '@/utils/cn';

import { SUGGESTED_DOUBTS } from '../constants';
import { MathText } from '@/features/canvas';

/** Example doubts, asked in one click (shown on the empty board). */
export function DoubtSuggestions({ onPick }) {
  return (
    <div
      className="flex max-w-2xl flex-wrap justify-center gap-1.5 sm:gap-2"
      aria-label="Example doubts"
    >
      {SUGGESTED_DOUBTS.map((text, index) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className={cn(
            'rounded-full border border-border bg-card/90 px-2.5 py-1 text-xs text-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-soft-foreground focus-ring sm:px-3 sm:py-1.5 sm:text-sm',
            // The board is small on phones: two examples are enough there.
            index > 1 && 'hidden sm:inline-flex'
          )}
        >
          <MathText text={text} />
        </button>
      ))}
    </div>
  );
}
