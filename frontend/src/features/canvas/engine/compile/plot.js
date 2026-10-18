import { scaleLinear } from 'd3-scale';

import { LABEL_PX, PALETTE } from '../board';
import { compileExpr, sampleFunction } from '../math/expr';
import { fitText } from './text';

const PAD = { left: 48, right: 16, top: 16, bottom: 48 };
const TICK = 5;
const Y_SPAN = 1e6; // never show more than this much of y at once
const MINUS = '−';

/** A short tick label: at most 4 significant digits, trailing zeros dropped, a real minus sign. */
export function formatNumber(value) {
  const rounded = Number(Number(value).toPrecision(4));
  if (rounded === 0) return '0';
  return rounded < 0 ? `${MINUS}${Math.abs(rounded)}` : String(rounded);
}

function frameOf(box, left = PAD.left) {
  return {
    left: box.x + left,
    right: box.x + box.w - PAD.right,
    top: box.y + PAD.top,
    bottom: box.y + box.h - PAD.bottom,
  };
}

const quantile = (sorted, q) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];

/**
 * The y-range to show: the middle 96% of the sampled values (so a pole's huge values
 * don't flatten the curve) plus every marked point, padded by 10%.
 */
function autoRange(curves, points) {
  const ys = curves
    .flatMap((segments) => segments.flatMap((segment) => segment.map(([, y]) => y)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const marks = points.map(([, y]) => y).filter(Number.isFinite);
  if (!ys.length && !marks.length) return [-5, 5];
  let low = Math.min(...(ys.length ? [quantile(ys, 0.02)] : []), ...marks);
  let high = Math.max(...(ys.length ? [quantile(ys, 0.98)] : []), ...marks);
  if (high - low > Y_SPAN) low = high - Y_SPAN;
  if (low === high) [low, high] = [low - 1, high + 1];
  const pad = (high - low) * 0.1;
  return [low - pad, high + pad];
}

/** Screen runs of a curve segment, split wherever it leaves the frame vertically. */
function visibleRuns(segment, x, y, frame) {
  const runs = [];
  let run = [];
  for (const [px, py] of segment) {
    const sy = y(py);
    if (sy < frame.top || sy > frame.bottom) {
      if (run.length > 1) runs.push(run);
      run = [];
      continue;
    }
    run.push([x(px), sy]);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

const clampTo = (value, low, high) => Math.min(Math.max(value, low), high);

/** A function graph: axes with ticks, one stroke per curve, shading, points and labels. */
export function compilePlot(action, { box, measure }) {
  const domain = Array.isArray(action.x) ? action.x : [-5, 5];
  const fns = (action.fns ?? []).map(compileExpr);
  const points = Object.entries(action.points ?? {});
  const samples = fns.map((fn) => (fn ? sampleFunction(fn, domain) : []));

  // The y range decides the tick labels, and their width decides the left margin.
  const yDomain = scaleLinear()
    .domain(
      Array.isArray(action.y)
        ? action.y
        : autoRange(
            samples,
            points.map(([, p]) => p)
          )
    )
    .nice()
    .domain();
  const yTickWidth = Math.max(
    0,
    ...scaleLinear()
      .domain(yDomain)
      .ticks(6)
      .map((tick) => measure(formatNumber(tick), LABEL_PX))
  );
  const frame = frameOf(box, Math.max(PAD.left, yTickWidth + 20));

  const x = scaleLinear().domain(domain).range([frame.left, frame.right]).nice();
  const y = scaleLinear().domain(yDomain).range([frame.bottom, frame.top]);
  const [x0, x1] = x.domain();
  const [y0, y1] = y.domain();
  const axisY = y0 <= 0 && y1 >= 0 ? y(0) : frame.bottom;
  const axisX = x0 <= 0 && x1 >= 0 ? x(0) : frame.left;
  const ink = 'ink';

  const parts = [
    { type: 'arrow', from: [frame.left, axisY], to: [frame.right, axisY], color: ink },
    { type: 'arrow', from: [axisX, frame.bottom], to: [axisX, frame.top], color: ink },
  ];

  for (const tick of x.ticks(6)) {
    const at = x(tick);
    if (tick === 0 || at < frame.left || at > frame.right) continue;
    parts.push({ type: 'line', from: [at, axisY - TICK], to: [at, axisY + TICK], color: ink });
    const text = formatNumber(tick);
    const half = measure(text, LABEL_PX) / 2;
    parts.push({
      type: 'label',
      text,
      x: clampTo(at, box.x + half + 1, box.x + box.w - half - 1),
      y: axisY + 30,
      px: LABEL_PX,
      color: ink,
      align: 'center',
    });
  }
  for (const tick of y.ticks(6)) {
    const at = y(tick);
    if (tick === 0 || at > frame.bottom || at < frame.top) continue;
    parts.push({ type: 'line', from: [axisX - TICK, at], to: [axisX + TICK, at], color: ink });
    const text = formatNumber(tick);
    parts.push({
      type: 'label',
      text,
      x: axisX - 10,
      y: at + 8,
      px: LABEL_PX,
      color: ink,
      align: 'right',
    });
  }

  const colorOf = (index) =>
    fns.length === 1 && action.color ? action.color : PALETTE[index % PALETTE.length];
  const ends = [];
  samples.forEach((segments, index) => {
    let last = null;
    for (const segment of segments) {
      for (const run of visibleRuns(segment, x, y, frame)) {
        parts.push({ type: 'path', points: run, color: colorOf(index) });
        last = run.at(-1);
      }
    }
    ends[index] = last;
  });

  const shade = action.shade;
  const shadeFn = shade ? fns[shade.fn ?? 0] : null;
  if (shadeFn) {
    const from = clampTo(shade.from, x0, x1);
    const to = clampTo(shade.to, x0, x1);
    if (to > from) {
      const base = clampTo(axisY, frame.top, frame.bottom);
      const edge = sampleFunction(shadeFn, [from, to], 60)
        .flat()
        .map(([px, py]) => [x(px), clampTo(y(py), frame.top, frame.bottom)]);
      if (edge.length > 1) {
        const color = colorOf(shade.fn ?? 0);
        const outline = [[x(from), base], ...edge, [x(to), base]];
        parts.push({ type: 'path', points: outline, color, closed: true, fill: true });
      }
    }
  }

  for (const [name, [px, py]] of points) {
    const sx = x(px);
    const sy = y(py);
    if (sx < frame.left || sx > frame.right || sy < frame.top || sy > frame.bottom) continue;
    parts.push({ type: 'dot', x: sx, y: sy, r: 7, color: 'red' });
    // Name to the right of the point, or to the left near the right edge.
    const flip = sx + 12 + measure(name, LABEL_PX) > box.x + box.w - 2;
    parts.push({
      type: 'label',
      text: name,
      x: flip ? sx - 12 : sx + 12,
      y: Math.max(sy - 12, box.y + LABEL_PX),
      px: LABEL_PX,
      color: 'red',
      align: flip ? 'right' : 'left',
    });
  }

  (action.labels ?? []).forEach((text, index) => {
    const end = ends[index];
    if (!end || !text) return;
    const lx = clampTo(end[0] - 8, box.x + 8, box.x + box.w - 8);
    const ly = clampTo(end[1] - 14, box.y + LABEL_PX, box.y + box.h - 8);
    parts.push({
      type: 'label',
      text: fitText(text, LABEL_PX, lx - box.x - 2, measure),
      x: lx,
      y: ly,
      px: LABEL_PX,
      color: colorOf(index),
      align: 'right',
    });
  });

  if (action.xlabel) {
    const text = fitText(action.xlabel, LABEL_PX, frame.right - box.x - 2, measure);
    parts.push({
      type: 'label',
      text,
      x: frame.right,
      y: axisY - 14,
      px: LABEL_PX,
      color: ink,
      align: 'right',
    });
  }
  if (action.ylabel) {
    const text = fitText(action.ylabel, LABEL_PX, box.x + box.w - axisX - 14, measure);
    parts.push({
      type: 'label',
      text,
      x: axisX + 12,
      y: frame.top + 22,
      px: LABEL_PX,
      color: ink,
      align: 'left',
    });
  }
  return parts;
}
