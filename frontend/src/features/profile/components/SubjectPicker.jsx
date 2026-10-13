import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Button, Input } from '@/components/ui';
import { cn } from '@/utils/cn';

import { MAX_SUBJECTS, suggestedSubjects } from '../constants';

export function SubjectPicker({ value = [], onChange, grade, error }) {
  const [custom, setCustom] = useState('');
  const selected = new Set(value.map((subject) => subject.toLowerCase()));
  const suggestions = suggestedSubjects(grade);
  const extras = value.filter(
    (subject) => !suggestions.some((item) => item.toLowerCase() === subject.toLowerCase())
  );
  const full = value.length >= MAX_SUBJECTS;

  const toggle = (subject) => {
    if (selected.has(subject.toLowerCase())) {
      onChange(value.filter((item) => item.toLowerCase() !== subject.toLowerCase()));
    } else if (!full) {
      onChange([...value, subject]);
    }
  };

  const addCustom = () => {
    const subject = custom.trim().replace(/\s+/g, ' ');
    if (subject.length < 2 || full) return;
    if (!selected.has(subject.toLowerCase())) onChange([...value, subject]);
    setCustom('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested subjects">
        {suggestions.map((subject) => {
          const active = selected.has(subject.toLowerCase());
          return (
            <button
              key={subject}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(subject)}
              disabled={!active && full}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-ring disabled:opacity-50',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted'
              )}
            >
              {active && <Check className="size-3.5" aria-hidden="true" />}
              {subject}
            </button>
          );
        })}
        {extras.map((subject) => (
          <span
            key={subject}
            className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary py-1.5 pr-1.5 pl-3.5 text-sm font-medium text-primary-foreground"
          >
            {subject}
            <button
              type="button"
              onClick={() => toggle(subject)}
              className="rounded-full p-0.5 hover:bg-white/20 focus-ring"
              aria-label={`Remove ${subject}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add another subject"
          aria-label="Add another subject"
          maxLength={50}
          disabled={full}
          className="h-10"
        />
        <Button variant="outline" onClick={addCustom} disabled={full || custom.trim().length < 2}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>

      <p
        className={cn('text-xs', error ? 'font-medium text-destructive' : 'text-muted-foreground')}
      >
        {error ?? `${value.length} of ${MAX_SUBJECTS} selected`}
      </p>
    </div>
  );
}
