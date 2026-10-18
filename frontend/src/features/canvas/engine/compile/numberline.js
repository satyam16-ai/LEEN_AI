import { scaleLinear } from 'd3-scale';

import { LABEL_PX } from '../board';
import { formatNumber } from './plot';

const INSET = 30;
const TICK = 10;

/** A number line with ticks, marked values, named points and an optional interval. */
export function compileNumberLine(action, { box }) {
  const range = Array.isArray(action.range) ? action.range : [-5, 5];
  const left = box.x + INSET;
  const right = box.x + box.w - INSET;
  const y = box.y + box.h / 2;
  const x = scaleLinear()
    .domain(range)
    .range([left + 20, right - 20]);
  const ink = 'ink';
  const accent = action.color ?? 'blue';

  const parts = [
    { type: 'arrow', from: [left, y], to: [right, y], color: ink },
    { type: 'arrow', from: [left + 24, y], to: [left, y], color: ink },
  ];
  for (const tick of x.ticks(12)) {
    const at = x(tick);
    parts.push({ type: 'line', from: [at, y - TICK], to: [at, y + TICK], color: ink });
    const text = formatNumber(tick);
    parts.push({
      type: 'label',
      text,
      x: at,
      y: y + 40,
      px: LABEL_PX,
      color: ink,
      align: 'center',
    });
  }

  const interval = action.interval;
  if (interval && Number.isFinite(interval.from) && Number.isFinite(interval.to)) {
    const [low, high] = range;
    const open = interval.open ?? [false, false];
    // An end at or past the edge of the line means "and beyond": draw a ray, not a dot.
    const unboundedLeft = interval.from <= low;
    const unboundedRight = interval.to >= high;
    const a = unboundedLeft ? left + 6 : x(interval.from);
    const b = unboundedRight ? right - 6 : x(interval.to);
    const shade = { color: accent, width: 8 };
    if (unboundedRight) parts.push({ type: 'arrow', from: [a, y], to: [b, y], ...shade });
    else if (unboundedLeft) parts.push({ type: 'arrow', from: [b, y], to: [a, y], ...shade });
    else
      parts.push({
        type: 'path',
        points: [
          [a, y],
          [b, y],
        ],
        ...shade,
      });
    if (!unboundedLeft)
      parts.push({ type: 'dot', x: a, y, r: 9, color: accent, hollow: Boolean(open[0]) });
    if (!unboundedRight)
      parts.push({ type: 'dot', x: b, y, r: 9, color: accent, hollow: Boolean(open[1]) });
  }

  const inRange = (value) => Number.isFinite(value) && value >= range[0] && value <= range[1];
  for (const value of (action.marks ?? []).filter(inRange)) {
    parts.push({ type: 'dot', x: x(value), y, r: 8, color: accent });
  }
  for (const [name, value] of Object.entries(action.labels ?? {})) {
    if (!inRange(value)) continue;
    parts.push({ type: 'dot', x: x(value), y, r: 8, color: 'red' });
    parts.push({
      type: 'label',
      text: name,
      x: x(value),
      y: y - 22,
      px: LABEL_PX,
      color: 'red',
      align: 'center',
    });
  }
  return parts;
}
