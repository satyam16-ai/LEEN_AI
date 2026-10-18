import { useEffect, useState, useSyncExternalStore } from 'react';

import { ttsService } from '@/services/ttsService';

import { BoardPlayer } from '../engine/BoardPlayer';
import { Narrator } from '../engine/narrator';

function createPlayer() {
  const player = new BoardPlayer();
  player.setNarrator(new Narrator(ttsService.speak));
  return player;
}

/** One BoardPlayer (with its narrator) per component, plus its React-visible state. */
export function useBoardPlayer() {
  const [player] = useState(createPlayer);
  const board = useSyncExternalStore(player.subscribe, player.getSnapshot);
  useEffect(() => () => player.narrator?.destroy(), [player]);
  return [player, board];
}
