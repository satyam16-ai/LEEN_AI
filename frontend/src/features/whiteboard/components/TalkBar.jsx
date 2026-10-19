import {
  Lightbulb,
  Mic,
  SendHorizontal,
  Shuffle,
  SkipForward,
  Sparkles,
  Square,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button, Card, Input } from '@/components/ui';
import { useSpeechInput } from '@/features/canvas';
import { cn } from '@/utils/cn';

const MIN_LENGTH = 3;
const LETTERS = 'ABCDEF';
const PLACEHOLDERS = {
  number: 'Your answer',
  expr: 'Type an expression in x',
  text: 'Type your answer',
};

function feedbackText(feedback) {
  switch (feedback?.kind) {
    case 'correct':
      return 'Correct! Well done.';
    case 'wrong':
      return 'Not quite. Have another go.';
    case 'final':
      return feedback.expected ? `The answer is ${feedback.expected}. Let's see why.` : null;
    case 'teacher':
      return 'Your teacher is checking your answer…';
    case 'marked':
      return 'See the board for what to fix.';
    case 'unreadable':
      return feedback.message;
    default:
      return null;
  }
}

function MicButton({ speech }) {
  if (!speech.supported) return null;
  return (
    <Button
      type="button"
      variant={speech.listening ? 'secondary' : 'outline'}
      onClick={speech.listening ? speech.stop : speech.start}
      aria-label={speech.listening ? 'Stop listening' : 'Speak'}
      title={speech.listening ? 'Stop listening' : 'Tap and speak'}
      className="h-10"
    >
      {speech.listening ? (
        <Square className="size-4" aria-hidden="true" />
      ) : (
        <Mic className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}

/**
 * Talk to the board by typing or speaking, at any time: the AI answers after the step
 * it is drawing. When the board asks a question, the bar becomes the answer box.
 */
export function TalkBar({
  ask = null,
  playing = false,
  busy = false,
  full = false,
  pending = null,
  unsent = null,
  checking = false,
  feedback = null,
  speechLang = 'en-IN',
  onListening,
  onSay,
  onAnswer,
  onSkip,
  onAnotherWay,
  onTryOne,
}) {
  const [text, setText] = useState('');
  const [value, setValue] = useState('');
  // Each question (even one reusing an id) starts with an empty box and its hint hidden.
  const [hintFor, setHintFor] = useState(null);
  const [seenAsk, setSeenAsk] = useState(ask);
  if (ask !== seenAsk) {
    setSeenAsk(ask);
    setValue('');
  }
  // A message whose turn failed comes back into the box, ready to send again.
  const [seenUnsent, setSeenUnsent] = useState(null);
  if (unsent !== seenUnsent) {
    setSeenUnsent(unsent);
    if (unsent) setText(unsent);
  }

  const speech = useSpeechInput({
    lang: speechLang,
    // Spoken answers fill the box so a misheard number can be fixed before checking.
    onFinal: (spoken) => {
      if (ask) setValue(spoken);
      else if (spoken.trim().length >= MIN_LENGTH) onSay(spoken.trim());
    },
  });

  useEffect(() => {
    onListening?.(speech.listening);
  }, [speech.listening, onListening]);

  // Closing the bar mid-sentence must not leave narration turned down.
  const onListeningRef = useRef(onListening);
  useEffect(() => {
    onListeningRef.current = onListening;
  });
  useEffect(() => () => onListeningRef.current?.(false), []);

  if (full && !ask) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        This board is full — start a new doubt to keep going.
      </p>
    );
  }

  const status = feedbackText(feedback);
  const heard = speech.error ?? speech.interim;
  const footer = (status || heard) && (
    <p
      className={cn(
        'text-sm',
        feedback?.kind === 'correct' ? 'text-success' : 'text-muted-foreground'
      )}
      aria-live="polite"
    >
      {heard || status}
    </p>
  );

  if (ask) {
    const answer = value.trim();
    const check = (event) => {
      event.preventDefault();
      if (checking || !answer) return;
      onAnswer(answer);
    };
    return (
      <Card className="space-y-2 p-3">
        <p className="text-sm font-medium">Your turn — answer the question on the board.</p>
        {ask.kind === 'choice' ? (
          <div className="flex flex-wrap gap-2">
            {(ask.options ?? []).map((option, index) => (
              <Button
                key={option}
                variant="outline"
                disabled={checking}
                onClick={() => onAnswer(LETTERS[index])}
              >
                {`${LETTERS[index]}. ${option}`}
              </Button>
            ))}
          </div>
        ) : (
          <form onSubmit={check} noValidate className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={200}
              inputMode={ask.kind === 'number' ? 'decimal' : undefined}
              aria-label="Your answer"
              placeholder={PLACEHOLDERS[ask.kind] ?? PLACEHOLDERS.text}
              className="h-10 flex-1"
            />
            {ask.kind === 'number' && ask.unit && (
              <span className="text-sm text-muted-foreground">{ask.unit}</span>
            )}
            {ask.kind === 'text' && <MicButton speech={speech} />}
            <Button type="submit" disabled={checking || !answer} className="h-10">
              Check
            </Button>
          </form>
        )}
        <div className="flex flex-wrap gap-2">
          {ask.hint && (
            <Button variant="ghost" size="sm" onClick={() => setHintFor(ask)}>
              <Lightbulb className="size-4" aria-hidden="true" />
              Hint
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onSkip} disabled={checking}>
            <SkipForward className="size-4" aria-hidden="true" />
            Skip
          </Button>
        </div>
        {ask.hint && (hintFor === ask || feedback?.kind === 'wrong') && (
          <p className="text-sm">{ask.hint}</p>
        )}
        {footer}
      </Card>
    );
  }

  const message = text.trim();
  const send = (event) => {
    event.preventDefault();
    if (message.length < MIN_LENGTH) return;
    onSay(message);
    setText('');
  };

  return (
    <Card className="space-y-2 p-3">
      {pending && (
        <p className="text-sm text-muted-foreground">
          You: <span className="text-foreground">{pending}</span> · LEEN will answer after this step
        </p>
      )}
      <form onSubmit={send} noValidate className="flex gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          aria-label="Say or type to your teacher"
          placeholder={
            playing
              ? 'Say or type anything — LEEN will answer after this step'
              : 'Ask a follow-up about this board'
          }
          className="h-10 flex-1"
        />
        <MicButton speech={speech} />
        <Button type="submit" disabled={message.length < MIN_LENGTH} className="h-10">
          <SendHorizontal className="size-4" aria-hidden="true" />
          Send
        </Button>
      </form>
      {!playing && !busy && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onAnotherWay}>
            <Shuffle className="size-4" aria-hidden="true" />
            Explain another way
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onTryOne}>
            <Sparkles className="size-4" aria-hidden="true" />
            Now you try
          </Button>
        </div>
      )}
      {footer}
    </Card>
  );
}
