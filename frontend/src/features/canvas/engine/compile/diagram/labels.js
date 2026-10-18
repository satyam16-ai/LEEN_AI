import { LABEL_PX } from '../../board';

export const label = (text, x, y, extra = {}) => ({
  type: 'label',
  text,
  x,
  y,
  px: LABEL_PX,
  color: 'ink',
  align: 'center',
  ...extra,
});

/**
 * Labels in the left and right margins of the box, each joined to the part it names
 * by a leader line. Labels go on the side nearer their anchor, at least 1.4 lines apart.
 */
export function leaderLabels(items, box, measure, { px = LABEL_PX, color = 'ink' } = {}) {
  const gap = px * 1.4;
  const top = box.y + px;
  const bottom = box.y + box.h - 6;
  const sides = { left: [], right: [] };
  for (const item of items) {
    sides[item.anchor[0] < box.x + box.w / 2 ? 'left' : 'right'].push(item);
  }
  const parts = [];
  for (const [side, list] of Object.entries(sides)) {
    list.sort((a, b) => a.anchor[1] - b.anchor[1]);
    let next = top;
    const ys = list.map((item) => {
      const y = Math.max(item.anchor[1] + px / 3, next);
      next = y + gap;
      return y;
    });
    const overflow = ys.length ? ys.at(-1) - bottom : 0;
    const placed = overflow > 0 ? ys.map((y) => Math.max(top, y - overflow)) : ys;
    list.forEach((item, i) => {
      const x = side === 'left' ? box.x + 4 : box.x + box.w - 4;
      const width = measure(item.text, px);
      const end =
        side === 'left'
          ? Math.min(x + width + 6, item.anchor[0])
          : Math.max(x - width - 6, item.anchor[0]);
      parts.push({ type: 'line', from: [end, placed[i] - px / 3], to: item.anchor, color });
      parts.push(label(item.text, x, placed[i], { px, color, align: side }));
    });
  }
  return parts;
}
