import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Sparkles, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button, Card, FormField, Select, Textarea } from '@/components/ui';
import { downscaleImage } from '@/utils/downscaleImage';

import { doubtSchema } from '../schemas';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_CHIP = 'mt-2 inline-flex items-center gap-2 rounded-lg border border-border p-1 pr-2';

/**
 * One-row doubt input. Enter asks; Shift+Enter adds a new line. A photo of the question can
 * go with it (then typing is optional).
 */
export function DoubtComposer({ subjects = [], busy = false, onAsk, onStop }) {
  const [photo, setPhotoState] = useState(null);
  const inputRef = useRef(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const {
    register,
    handleSubmit,
    resetField,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(doubtSchema),
    defaultValues: { question: '', subject: '', hasPhoto: false },
  });

  // With a photo attached, typing is optional (the schema reads hasPhoto).
  const setPhoto = (value) => {
    setValue('hasPhoto', Boolean(value));
    setPhotoState(value);
  };

  const submit = handleSubmit(({ question, subject }) => {
    const asked = { question, subject: subject || null };
    onAsk(photo ? { ...asked, photo } : asked);
    // Like a chat box: the asked question moves above the board.
    resetField('question');
    setPhoto(null);
  });

  const choosePhoto = async (event) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file) return;
    const ready = await downscaleImage(file);
    if (ready.size > MAX_PHOTO_BYTES) {
      toast.error('Photos must be 8 MB or smaller.');
      return;
    }
    clearErrors('question');
    setPhoto(ready);
  };

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
            placeholder={
              photo
                ? 'Add a note about the photo (optional)'
                : 'Ask a doubt, or add a photo of the question'
            }
            className="max-h-36 min-h-11 resize-none [field-sizing:content]"
            onKeyDown={onKeyDown}
            {...register('question')}
          />
          {preview && (
            <div className={PHOTO_CHIP}>
              <img src={preview} alt="Your photo" className="size-12 rounded-md object-cover" />
              <span className="text-xs text-muted-foreground">Photo added</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPhoto(null)}
                aria-label="Remove photo"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </FormField>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Add a photo of the question"
            onChange={choosePhoto}
          />
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Take or choose a photo"
            title="Add a photo of the question"
          >
            <Camera className="size-4" aria-hidden="true" />
          </Button>
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
