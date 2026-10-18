import { label } from './labels';

const CAPACITY = [2, 8, 8, 2];
const NUCLEUS = 30;

/** Electrons per shell in the simple Bohr model taught up to Z = 20 (2, 8, 8, 2). */
export function shellConfig(z) {
  let left = Math.max(1, Math.min(20, Math.round(z) || 1));
  const shells = [];
  for (const capacity of CAPACITY) {
    if (left <= 0) break;
    const count = Math.min(capacity, left);
    shells.push(count);
    left -= count;
  }
  return shells;
}

/** Bohr model: nucleus, concentric shells with evenly spaced electrons, and the configuration. */
export function compileAtom(action, { box }) {
  const z = action.z ?? 1;
  const shells = shellConfig(z);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2 - 12;
  const outer = Math.min(box.w, box.h) / 2 - 40;
  const gap = (outer - NUCLEUS) / shells.length;
  const parts = [
    { type: 'circle', x: cx, y: cy, r: NUCLEUS, color: 'red' },
    label(action.symbol ?? `${shells.reduce((a, b) => a + b, 0)}p`, cx, cy + 8, { color: 'red' }),
  ];
  shells.forEach((count, k) => {
    const r = NUCLEUS + gap * (k + 1);
    parts.push({ type: 'circle', x: cx, y: cy, r, color: 'ink' });
    for (let j = 0; j < count; j += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * j) / count;
      parts.push({
        type: 'dot',
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        r: 6,
        color: 'blue',
      });
    }
  });
  parts.push(label(shells.join(', '), cx, box.y + box.h - 8, { color: 'blue' }));
  return parts;
}
