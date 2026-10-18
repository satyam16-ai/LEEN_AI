import { label } from './labels';

const KINDS = ['battery', 'resistor', 'bulb', 'switch', 'ammeter', 'voltmeter'];
const HALF = 32; // half the width of a component symbol
const INSET_X = 40;
const INSET_Y = 56;

function parse(part) {
  const [first = '', ...rest] = String(part).trim().split(/\s+/);
  const kind = first.toLowerCase();
  return KINDS.includes(kind)
    ? { kind, text: rest.join(' ') }
    : { kind: 'resistor', text: String(part).trim() };
}

const wire = (from, to) => ({ type: 'path', points: [from, to], color: 'ink' });

/** A horizontal component symbol centred on (cx, y), spanning cx ± 32. */
function symbol(kind, cx, y) {
  const ink = 'ink';
  const stubs = (inner) => [
    wire([cx - HALF, y], [cx - inner, y]),
    wire([cx + inner, y], [cx + HALF, y]),
  ];
  switch (kind) {
    case 'battery':
      return [
        ...stubs(6),
        {
          type: 'path',
          points: [
            [cx - 6, y - 24],
            [cx - 6, y + 24],
          ],
          color: ink,
        },
        {
          type: 'path',
          points: [
            [cx + 6, y - 12],
            [cx + 6, y + 12],
          ],
          color: ink,
          width: 7,
        },
      ];
    case 'bulb':
      return [
        ...stubs(20),
        { type: 'circle', x: cx, y, r: 20, color: ink },
        { type: 'line', from: [cx - 14, y - 14], to: [cx + 14, y + 14], color: ink },
        { type: 'line', from: [cx - 14, y + 14], to: [cx + 14, y - 14], color: ink },
      ];
    case 'switch':
      return [
        ...stubs(22),
        { type: 'dot', x: cx - 20, y, r: 4, color: ink },
        {
          type: 'path',
          points: [
            [cx - 20, y],
            [cx + 18, y - 20],
          ],
          color: ink,
        },
        { type: 'dot', x: cx + 20, y, r: 4, color: ink },
      ];
    case 'ammeter':
    case 'voltmeter':
      return [
        ...stubs(20),
        { type: 'circle', x: cx, y, r: 20, color: ink },
        label(kind === 'ammeter' ? 'A' : 'V', cx, y + 8),
      ];
    default: {
      const zig = [-24, -20, -12, -4, 4, 12, 20, 24].map((dx, i) => [
        cx + dx,
        y + (i === 0 || i === 7 ? 0 : i % 2 ? -10 : 10),
      ]);
      return [{ type: 'path', points: [[cx - HALF, y], ...zig, [cx + HALF, y]], color: ink }];
    }
  }
}

/** A straight wire from x0 to x1 at height y, with components centred at `slots`. */
function rail(x0, x1, y, slots) {
  const parts = [];
  let from = x0;
  for (const x of slots) {
    if (x - HALF > from) parts.push(wire([from, y], [x - HALF, y]));
    from = x + HALF;
  }
  if (x1 > from) parts.push(wire([from, y], [x1, y]));
  return parts;
}

const spread = (count, a, b) =>
  Array.from({ length: count }, (_, i) => a + ((b - a) * (i + 1)) / (count + 1));

function series(parts, frame) {
  const { left, right, top, bottom } = frame;
  const upper = parts.slice(0, Math.ceil(parts.length / 2));
  const lower = parts.slice(upper.length);
  const upperX = spread(upper.length, left, right);
  const lowerX = spread(lower.length, left, right);
  const out = [
    ...rail(left, right, top, upperX),
    wire([right, top], [right, bottom]),
    ...rail(left, right, bottom, lowerX),
    wire([left, top], [left, bottom]),
  ];
  upper.forEach((part, i) => {
    out.push(...symbol(part.kind, upperX[i], top));
    if (part.text) out.push(label(part.text, upperX[i], top - 34));
  });
  lower.forEach((part, i) => {
    out.push(...symbol(part.kind, lowerX[i], bottom));
    if (part.text) out.push(label(part.text, lowerX[i], bottom + 46));
  });
  return out;
}

function parallel(parts, frame) {
  const { left, right, top, bottom } = frame;
  const sourceIndex = Math.max(
    0,
    parts.findIndex((part) => part.kind === 'battery')
  );
  const source = parts[sourceIndex];
  const branches = parts.filter((_, i) => i !== sourceIndex);
  const middle = (left + right) / 2;
  const out = [
    ...rail(left, right, top, [middle]),
    ...symbol(source.kind, middle, top),
    wire([left, top], [left, bottom]),
    wire([right, top], [right, bottom]),
  ];
  if (source.text) out.push(label(source.text, middle, top - 34));
  const count = Math.max(branches.length, 1);
  branches.forEach((part, i) => {
    const y = top + ((bottom - top) * (i + 1)) / count;
    out.push(...rail(left, right, y, [middle]), ...symbol(part.kind, middle, y));
    if (part.text) out.push(label(part.text, middle + HALF + 8, y - 8, { align: 'left' }));
  });
  if (!branches.length) out.push(wire([left, bottom], [right, bottom]));
  return out;
}

/** A circuit diagram: components in a series loop, or on parallel branches. */
export function compileCircuit(action, { box }) {
  const parts = (action.parts ?? []).map(parse);
  if (!parts.length) parts.push({ kind: 'battery', text: '' }, { kind: 'bulb', text: '' });
  const frame = {
    left: box.x + INSET_X,
    right: box.x + box.w - INSET_X,
    top: box.y + INSET_Y,
    bottom: box.y + box.h - INSET_Y,
  };
  return action.layout === 'parallel' && parts.length > 1
    ? parallel(parts, frame)
    : series(parts, frame);
}
