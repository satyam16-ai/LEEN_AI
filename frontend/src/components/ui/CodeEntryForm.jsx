import { useId, useState } from 'react';

import { Button } from './Button';
import { inputClasses } from './styles';
import { cn } from '@/utils/cn';

const ALLOWED = /[^A-Z0-9]/g;

function formatCode(raw, length, groupSize) {
  const clean = raw.toUpperCase().replace(ALLOWED, '').slice(0, length);
  if (!groupSize || clean.length <= groupSize) return clean;
  return `${clean.slice(0, groupSize)}-${clean.slice(groupSize)}`;
}

/**
 * Input for short share codes (parent link codes, class join codes). Uppercases,
 * strips separators and groups characters; `onSubmit` gets the formatted code and
 * may throw an Error whose message is shown under the field.
 */
export function CodeEntryForm({
  label,
  placeholder,
  length,
  groupSize,
  submitLabel,
  onSubmit,
  pending = false,
}) {
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const complete = value.replace('-', '').length === length;

  const submit = async (event) => {
    event.preventDefault();
    if (!complete) {
      setError(`Enter the full ${length}-character code`);
      return;
    }
    setError(null);
    try {
      await onSubmit(value);
      setValue('');
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={value}
          onChange={(event) => {
            setValue(formatCode(event.target.value, length, groupSize));
            setError(null);
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            inputClasses,
            'h-12 font-mono text-lg tracking-[0.25em] uppercase placeholder:tracking-[0.2em] sm:max-w-xs'
          )}
        />
        <Button type="submit" size="lg" loading={pending}>
          {submitLabel}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
