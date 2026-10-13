import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles, Square } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button, Card, FormField, Select, Textarea } from '@/components/ui';

import { doubtSchema } from '../schemas';

/** One-row doubt input. Enter asks; Shift+Enter adds a new line. */
export function DoubtComposer({ subjects = [], busy = false, onAsk, onStop }) {
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(doubtSchema),
    defaultValues: { question: '', subject: '' },
  });

  const submit = handleSubmit(({ question, subject }) => {
    onAsk({ question, subject: subject || null });
    // Like a chat box: the asked question moves above the board.
    resetField('question');
  });

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!busy) submit();
    }
  };

  return (
    <Card className="p-3 sm:p-4">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <FormField id="doubt-question" error={errors.question?.message} className="flex-1">
          <Textarea
            rows={1}
            maxLength={500}
            aria-label="What's your doubt?"
            placeholder="Type your doubt, e.g. Why is (x+y)² = x² + 2xy + y²?"
            className="max-h-36 min-h-11 resize-none [field-sizing:content]"
            onKeyDown={onKeyDown}
            {...register('question')}
          />
        </FormField>

        <div className="flex gap-2">
          {subjects.length > 0 && (
            <Select aria-label="Subject" className="h-11 w-auto min-w-0" {...register('subject')}>
              <option value="">Any subject</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </Select>
          )}
          {/* Distinct keys: reusing one <button> would let the Stop click turn into a
              submit once the stream ends and the button switches to type="submit". */}
          {busy ? (
            <Button
              key="stop"
              variant="outline"
              className="h-11 flex-1 sm:flex-none"
              onClick={(event) => {
                event.preventDefault();
                onStop();
              }}
            >
              <Square className="size-4" aria-hidden="true" />
              Stop
            </Button>
          ) : (
            <Button key="ask" type="submit" className="h-11 flex-1 sm:flex-none">
              <Sparkles className="size-4" aria-hidden="true" />
              Explain
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
