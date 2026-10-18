import { BOARD_HEIGHT, BOARD_WIDTH } from './board';

const MAX_ZOOM = 2.5;

/**
 * CSS zoom for a `focus` box [x, y, w, h]: scale it up to fill the board (at most
 * 2.5×) and move its centre to the board's centre. tx/ty are percentages of the
 * board, for `translate(tx%, ty%) scale(scale)` with a centred transform origin.
 */
export function cameraTransform(focus) {
  if (!Array.isArray(focus) || focus.length !== 4) return { scale: 1, tx: 0, ty: 0 };
  const [x, y, w, h] = focus;
  const scale = Math.min(BOARD_WIDTH / w, BOARD_HEIGHT / h, MAX_ZOOM);
  const dx = x + w / 2 - BOARD_WIDTH / 2;
  const dy = y + h / 2 - BOARD_HEIGHT / 2;
  return {
    scale,
    tx: ((-scale * dx) / BOARD_WIDTH) * 100 || 0,
    ty: ((-scale * dy) / BOARD_HEIGHT) * 100 || 0,
  };
}
