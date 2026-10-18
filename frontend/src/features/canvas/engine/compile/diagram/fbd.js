import { LABEL_PX } from '../../board';
import { label } from './labels';

const DIRECTIONS = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };

/** Screen angle for "up"/"down"/"left"/"right" or degrees counter-clockwise from +x. */
function angleOf(dir) {
  if (typeof dir === 'number' && Number.isFinite(dir)) return (-dir * Math.PI) / 180;
  return DIRECTIONS[dir] ?? null;
}

/** Free-body diagram: a block or ball with one labelled arrow per force. */
export function compileFbd(action, { box }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const ball = action.body === 'ball';
  const scale = Math.min(1, Math.min(box.w, box.h) / 320);
  const [hw, hh, r] = [55 * scale, 40 * scale, 45 * scale];
  const color = action.color ?? 'ink';
  const parts = ball
    ? [{ type: 'circle', x: cx, y: cy, r, color }]
    : [{ type: 'rect', x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2, color }];

  const reach = Math.min(box.w, box.h) / 2 - Math.max(ball ? r : hw, hh) - LABEL_PX - 8;
  const base = Math.max(10, Math.min(70, reach / 2));
  for (const force of action.forces ?? []) {
    const angle = angleOf(force.dir);
    if (angle === null) continue;
    const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
    const edge = ball ? r : Math.min(hw / Math.abs(ux || 1e-9), hh / Math.abs(uy || 1e-9));
    const start = [cx + ux * edge, cy + uy * edge];
    const length = base * Math.min(Math.max(force.size ?? 1, 0.5), 2);
    const end = [start[0] + ux * length, start[1] + uy * length];
    parts.push({ type: 'arrow', from: start, to: end, color: 'red' });
    if (force.label) {
      // Sideways forces: the text starts just past the tip; up/down: centred above/below it.
      const sideways = Math.abs(ux) > 0.5;
      const align = sideways ? (ux > 0 ? 'left' : 'right') : 'center';
      const gap = sideways ? 10 : 20;
      const at = [end[0] + ux * gap, end[1] + uy * gap + LABEL_PX / 3];
      parts.push(label(force.label, at[0], at[1], { color: 'red', align }));
    }
  }
  return parts;
}
