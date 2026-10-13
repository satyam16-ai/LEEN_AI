import { useId } from 'react';

import { cn } from '@/utils/cn';

/**
 * Single-choice group built on native radios (keyboard + screen-reader friendly).
 * variant "card" shows label + description; "pill" is compact (e.g. class numbers).
 */
export function ChoiceGroup({
  label,
  options,
  value,
  onChange,
  error,
  variant = 'card',
  className,
}) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset className="space-y-2.5" aria-describedby={error ? errorId : undefined}>
      {label && <legend className="mb-2.5 text-sm font-medium">{label}</legend>}
      <div className={cn('grid gap-2.5', className)}>
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <label key={option.value} className="relative block">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex h-full cursor-pointer border border-border bg-card transition-all',
                  'hover:border-primary/40 hover:bg-muted/50',
                  'peer-checked:border-primary peer-checked:bg-primary-soft/60 peer-checked:text-primary-soft-foreground',
                  'peer-focus-visible:ring-4 peer-focus-visible:ring-ring/25',
                  variant === 'card'
                    ? 'gap-3 rounded-xl p-4'
                    : 'items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold',
                  error && 'border-destructive/60'
                )}
              >
                {Icon && (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                )}
                {variant === 'card' ? (
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold">{option.label}</span>
                    {option.description && (
                      <span className="block text-xs leading-snug text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                ) : (
                  option.label
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
