import { Monitor, Moon, Sun } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Theme</CardTitle>
        <CardDescription>Choose how LEEN AI looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="grid max-w-lg grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all focus-ring',
                theme === value
                  ? 'border-primary bg-primary-soft/60 text-primary-soft-foreground ring-4 ring-primary/10'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
