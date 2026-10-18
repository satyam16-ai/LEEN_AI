import { SendHorizontal, Shuffle } from 'lucide-react';
import { useState } from 'react';

import { Button, Card, Input } from '@/components/ui';

const MIN_LENGTH = 3;

/** Ask a follow-up about the board, or ask for the same doubt explained another way. */
export function FollowUpBar({ onFollowUp, onAnotherWay, busy = false, full = false }) {
  const [text, setText] = useState('');

  if (full) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        This board is full — start a new doubt to keep going.
      </p>
    );
  }

  const question = text.trim();
  const send = (event) => {
    event.preventDefault();
    if (busy || question.length < MIN_LENGTH) return;
    onFollowUp(question);
    setText('');
  };

  return (
    <Card className="p-3">
      <form onSubmit={send} noValidate className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          disabled={busy}
          aria-label="Ask a follow-up about this board"
          placeholder="Ask a follow-up about this board"
          className="h-10 flex-1"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || question.length < MIN_LENGTH} className="h-10">
            <SendHorizontal className="size-4" aria-hidden="true" />
            Send
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onAnotherWay}
            disabled={busy}
            className="h-10"
          >
            <Shuffle className="size-4" aria-hidden="true" />
            Explain another way
          </Button>
        </div>
      </form>
    </Card>
  );
}
