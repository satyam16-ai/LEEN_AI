import { scaleBand, scaleLinear, scalePoint } from 'd3-scale';
import { pie } from 'd3-shape';

import { LABEL_PX, PALETTE } from '../board';
import { formatNumber } from './plot';
import { fitText } from './text';

const PAD = { left: 24, right: 24, top: 48, bottom: 44 };
const SLICE_STEP = Math.PI / 45; // 4°

function frameOf(box, hasTitle) {
  return {
    left: box.x + PAD.left,
    right: box.x + box.w - PAD.right,
    top: box.y + (hasTitle ? PAD.top : 16),
    bottom: box.y + box.h - PAD.bottom,
  };
}

const label = (text, x, y, color = 'ink', align = 'center') => ({
  type: 'label',
  text,
  x,
  y,
  px: LABEL_PX,
  color,
  align,
});

function bars(action, frame, labels, values, measure) {
  const band = scaleBand()
    .domain(labels.map((_, i) => i))
    .range([frame.left, frame.right])
    .padding(0.25);
  const top = frame.top + LABEL_PX + 8; // room for value labels
  const y = scaleLinear()
    .domain([Math.min(0, ...values), Math.max(0, ...values)])
    .range([frame.bottom, top]);
  const zero = y(0);
  const parts = [{ type: 'line', from: [frame.left, zero], to: [frame.right, zero], color: 'ink' }];
  values.forEach((value, i) => {
    const x = band(i);
    const height = Math.abs(y(value) - zero);
    const color = action.color ?? PALETTE[i % PALETTE.length];
    parts.push({
      type: 'rect',
      x,
      y: Math.min(y(value), zero),
      w: band.bandwidth(),
      h: height,
      color,
      fill: true,
    });
    const room = band.step() - 4;
    const valueText = fitText(
      `${formatNumber(value)}${action.unit ?? ''}`,
      LABEL_PX,
      room,
      measure
    );
    parts.push(label(valueText, x + band.bandwidth() / 2, Math.min(y(value), zero) - 8, color));
    parts.push(
      label(
        fitText(labels[i], LABEL_PX, room, measure),
        x + band.bandwidth() / 2,
        frame.bottom + 30
      )
    );
  });
  return parts;
}

function slices(action, frame, labels, values, measure, box) {
  // A pie has no category axis, so it can use the full height below the title.
  const bottom = frame.bottom + PAD.bottom - 16;
  const cx = (frame.left + frame.right) / 2;
  const cy = (frame.top + bottom) / 2;
  const radius = Math.max(10, Math.min(frame.right - frame.left, bottom - frame.top) / 2 - 20);
  const at = (angle, r) => [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
  const parts = [];
  pie()
    .sort(null)(values.map((value) => Math.max(value, 0)))
    .forEach((arc, i) => {
      const span = arc.endAngle - arc.startAngle;
      if (span <= 0) return;
      const steps = Math.max(1, Math.ceil(span / SLICE_STEP));
      const rim = Array.from({ length: steps + 1 }, (_, k) =>
        at(arc.startAngle + (span * k) / steps, radius)
      );
      const color = PALETTE[i % PALETTE.length];
      parts.push({
        type: 'path',
        points: [[cx, cy], ...rim],
        color,
        closed: true,
        fill: true,
        span,
      });
      const middle = arc.startAngle + span / 2;
      const [lx, ly] = at(middle, radius + 18);
      const align = Math.sin(middle) >= 0 ? 'left' : 'right';
      const room = align === 'left' ? box.x + box.w - lx - 2 : lx - box.x - 2;
      parts.push(
        label(fitText(labels[i], LABEL_PX, room, measure), lx, ly + LABEL_PX / 3, color, align)
      );
    });
  return parts;
}

function line(action, frame, labels, values, measure) {
  const axisX = frame.left + 44;
  const x = scalePoint()
    .domain(labels.map((_, i) => i))
    .range([axisX + 20, frame.right - 20]);
  const y = scaleLinear()
    .domain([Math.min(0, ...values), Math.max(...values, 1)])
    .nice()
    .range([frame.bottom, frame.top + 10]);
  const color = action.color ?? 'blue';
  const points = values.map((value, i) => [x(i), y(value)]);
  const parts = [
    { type: 'line', from: [axisX, frame.bottom], to: [frame.right, frame.bottom], color: 'ink' },
    { type: 'line', from: [axisX, frame.bottom], to: [axisX, frame.top + 6], color: 'ink' },
  ];
  for (const tick of y.ticks(5)) {
    const at = y(tick);
    parts.push({ type: 'line', from: [axisX - 5, at], to: [axisX + 5, at], color: 'ink' });
    parts.push(label(formatNumber(tick), axisX - 10, at + 8, 'ink', 'right'));
  }
  parts.push({ type: 'path', points, color });
  points.forEach(([px, py], i) => {
    parts.push({ type: 'dot', x: px, y: py, r: 6, color });
    const room = (frame.right - axisX - 40) / Math.max(labels.length - 1, 1);
    parts.push(label(fitText(labels[i], LABEL_PX, room, measure), px, frame.bottom + 30));
  });
  return parts;
}

/** Bar, pie or line chart of labelled values, with an optional title. */
export function compileChart(action, { box, measure }) {
  const count = Math.min(action.labels?.length ?? 0, action.values?.length ?? 0);
  if (!count) return [];
  const labels = action.labels.slice(0, count).map(String);
  const values = action.values.slice(0, count).map(Number);
  const frame = frameOf(box, Boolean(action.title));
  const parts = action.title
    ? [
        label(
          fitText(action.title, LABEL_PX, box.w - 8, measure),
          box.x + box.w / 2,
          box.y + 30,
          action.color ?? 'ink'
        ),
      ]
    : [];
  const kind = action.kind === 'pie' ? slices : action.kind === 'line' ? line : bars;
  return [...parts, ...kind(action, frame, labels, values, measure, box)];
}
