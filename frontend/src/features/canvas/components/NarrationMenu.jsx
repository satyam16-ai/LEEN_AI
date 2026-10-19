import { Check, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import { cn } from '@/utils/cn';

import { DEFAULT_VOICE, VOICES } from '../engine/narrator';

const STORAGE_KEY = 'leen-narration';

function readChoice() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'off' || VOICES[stored] ? stored : 'off';
  } catch {
    return 'off';
  }
}

/** Off, or an English or Hindi voice. The choice is remembered on this device. */
export function NarrationMenu({ player }) {
  const [choice, setChoice] = useState(readChoice);

  useEffect(() => {
    player.narrator?.setVoice(choice === 'off' ? DEFAULT_VOICE : choice);
    player.setNarrate(choice !== 'off');
  }, [player, choice]);

  const choose = (next) => {
    setChoice(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* not remembered, still applies now */
    }
  };

  const options = [['off', 'Off'], ...Object.entries(VOICES)];
  const on = choice !== 'off';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={on ? 'secondary' : 'ghost'}
          size="sm"
          aria-label={on ? `Narration: ${VOICES[choice]}` : 'Narration off'}
          title="Read captions aloud"
        >
          {on ? (
            <Volume2 className="size-4" aria-hidden="true" />
          ) : (
            <VolumeX className="size-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{on ? VOICES[choice].split(' ')[0] : 'Voice'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Read captions aloud
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(([value, label]) => (
          <DropdownMenuItem key={value} onSelect={() => choose(value)}>
            <Check
              className={cn('size-4', value === choice ? 'opacity-100' : 'opacity-0')}
              aria-hidden="true"
            />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
