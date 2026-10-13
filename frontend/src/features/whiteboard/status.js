import { CircleAlert, CircleCheck, Loader2, Pause, PencilLine, Square } from 'lucide-react';

/** Status pill for the board, from the live session phase and the player state. */
export function boardStatus(phase, playerStatus) {
  if (phase === 'connecting' || (phase === 'streaming' && playerStatus === 'waiting')) {
    return { label: 'Thinking…', icon: Loader2, spin: true };
  }
  if (playerStatus === 'paused') return { label: 'Paused', icon: Pause };
  if (playerStatus === 'playing') return { label: 'Writing…', icon: PencilLine };
  if (phase === 'error') return { label: 'Interrupted', icon: CircleAlert, tone: 'danger' };
  if (phase === 'stopped') return { label: 'Stopped', icon: Square };
  if (playerStatus === 'finished') return { label: 'Done', icon: CircleCheck, tone: 'success' };
  return null;
}
