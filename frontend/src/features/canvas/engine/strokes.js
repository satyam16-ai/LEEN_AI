/**
 * Hand-drawn geometry. Every path gets a slight wobble from a seeded PRNG, so a
 * replay (or a redraw after resize) looks exactly like the first time.
 */

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += dist(points[i - 1], points[i]);
  return total;
}

/** Points of `points` up to fraction `t` of its length (the last one interpolated). */
export function partialPath(points, t) {
  if (t >= 1 || points.length < 2) return points;
  let remaining = pathLength(points) * Math.max(t, 0);
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const segment = dist(points[i - 1], points[i]);
    if (remaining <= segment) {
      const k = segment ? remaining / segment : 0;
      const [ax, ay] = points[i - 1];
      out.push([ax + (points[i][0] - ax) * k, ay + (points[i][1] - ay) * k]);
      return out;
    }
    remaining -= segment;
    out.push(points[i]);
  }
  return out;
}

/** A slightly wavy line: smooth sideways drift, never a perfect ruler line. */
export function wobblyLine(from, to, rng, amplitude) {
  const length = dist(from, to);
  const steps = Math.max(6, Math.round(length / 14));
  const amp = amplitude ?? Math.min(2.4, 0.6 + length * 0.004);
  const phase = rng() * Math.PI * 2;
  const freq = 1 + rng() * 1.5;
  const [nx, ny] = length ? [-(to[1] - from[1]) / length, (to[0] - from[0]) / length] : [0, 0];
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    // Taper the drift to zero at both ends so lines meet where intended.
    const offset = Math.sin(t * Math.PI) * Math.sin(phase + t * Math.PI * freq) * amp;
    points.push([
      from[0] + (to[0] - from[0]) * t + nx * offset,
      from[1] + (to[1] - from[1]) * t + ny * offset,
    ]);
  }
  return points;
}

/** Four strokes with a little corner overshoot, like a box drawn by hand. */
export function rectStrokes(x, y, w, h, rng) {
  const over = () => 3 + rng() * 5;
  return [
    wobblyLine([x - over(), y], [x + w + over(), y], rng),
    wobblyLine([x + w, y - over()], [x + w, y + h + over()], rng),
    wobblyLine([x + w + over(), y + h], [x - over(), y + h], rng),
    wobblyLine([x, y + h + over()], [x, y - over()], rng),
  ];
}

export function circleStroke(cx, cy, r, rng) {
  const start = rng() * Math.PI * 2;
  const sweep = Math.PI * 2 + 0.3; // closes with a small overlap
  const steps = Math.max(24, Math.round((r * sweep) / 10));
  const squash = 1 + (rng() - 0.5) * 0.06;
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = start + (sweep * i) / steps;
    const radius = r * (1 + Math.sin(angle * 3 + start) * 0.012);
    points.push([cx + Math.cos(angle) * radius * squash, cy + Math.sin(angle) * radius]);
  }
  return points;
}

export function arrowStrokes(from, to, rng) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const head = Math.min(28, Math.max(14, dist(from, to) * 0.18));
  const wing = (side) => [
    to[0] - Math.cos(angle + side * 0.45) * head,
    to[1] - Math.sin(angle + side * 0.45) * head,
  ];
  return [
    wobblyLine(from, to, rng),
    wobblyLine(wing(1), to, rng, 0.5),
    wobblyLine(to, wing(-1), rng, 0.5),
  ];
}

/** Back-and-forth eraser passes that cover the whole rectangle. */
export function eraserPath(x, y, w, h, eraserHeight) {
  const step = eraserHeight * 0.7;
  const rows = Math.max(1, Math.ceil(h / step));
  const points = [];
  for (let row = 0; row <= rows; row += 1) {
    const rowY = Math.min(y + h, y + row * step);
    const [startX, endX] = row % 2 === 0 ? [x, x + w] : [x + w, x];
    points.push([startX, rowY], [endX, rowY]);
  }
  return points;
}
