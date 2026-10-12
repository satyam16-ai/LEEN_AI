import { Check } from 'lucide-react';

import { cn } from '@/utils/cn';
import { PASSWORD_RULES, scorePassword } from '@/utils/passwordStrength';

const BAR_COLORS = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-accent', 'bg-success'];

export function PasswordStrength({ value = '', className }) {
  const { score, label } = scorePassword(value);

  return (
    <div className={cn('space-y-2.5', className)} aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                'h-1.5 flex-1 rounded-full bg-muted transition-colors duration-300',
                value && step <= Math.max(score, 1) && BAR_COLORS[score]
              )}
            />
          ))}
        </div>
        {value && (
          <span className="w-16 text-right text-xs font-medium text-muted-foreground">{label}</span>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(value);
          return (
            <li
              key={rule.id}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                passed ? 'text-success' : 'text-muted-foreground'
              )}
            >
              <Check className={cn('size-3.5', !passed && 'opacity-30')} aria-hidden="true" />
              {rule.label}
              <span className="sr-only">{passed ? '(met)' : '(not met)'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
