import { BOARD_WIDTH, STAGE } from '../board';

/** Height a visual gets on the stage when the AI does not give it a box. */
export const DEFAULT_HEIGHT = {
  plot: 360,
  numberline: 140,
  geo: 360,
  table: 340,
  chart: 360,
  flow: 380,
  diagram: 380,
};
const GAP = 30;

/**
 * The box a visual is drawn in: its own `at` [x, y, w, h], or the next free slot
 * on the stage. `state.stageY` is where the next slot starts; it wraps to the top
 * when the stage is full.
 */
export function placeVisual(action, state) {
  if (Array.isArray(action.at) && action.at.length === 4) {
    const [x, y, w, h] = action.at;
    return { x, y, w, h };
  }
  const h = Math.min(DEFAULT_HEIGHT[action.type] ?? 380, STAGE.h);
  if (state.stageY + h > STAGE.y + STAGE.h) state.stageY = STAGE.y;
  const box = { x: STAGE.x, y: state.stageY, w: STAGE.w, h };
  state.stageY += h + GAP;
  return box;
}

const WRITE_EDGE = 24;

/**
 * How wide a write starting at x may be. Writes in a column stop before the stage,
 * so they never run under a visual; full-width and on-stage writes may reach the edge.
 */
export function writeRoom(x, column) {
  if (column === 'full' || x >= STAGE.x) return BOARD_WIDTH - WRITE_EDGE - x;
  return STAGE.x - 20 - x;
}
