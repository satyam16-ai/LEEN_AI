import { label } from './labels';

/** Thin-lens image (cartesian signs): f > 0 convex, f < 0 concave; u = object distance > 0. */
export function lensImage(f, u) {
  const v = 1 / (1 / f - 1 / u);
  return { v, m: v / -u, real: v > 0 };
}

/** Spherical-mirror image: f = focal length > 0, u = object distance > 0; v < 0 is in front. */
export function mirrorImage(f, u, shape) {
  const fs = shape === 'concave' ? -f : f;
  const us = -u;
  const v = 1 / (1 / fs - 1 / us);
  return { v, m: -v / us, real: v < 0 };
}

/** Clip the segment a→b to the rectangle (Liang–Barsky); null when it misses. */
function clip(a, b, rect) {
  let [t0, t1] = [0, 1];
  const d = [b[0] - a[0], b[1] - a[1]];
  const checks = [
    [-d[0], a[0] - rect.left],
    [d[0], rect.right - a[0]],
    [-d[1], a[1] - rect.top],
    [d[1], rect.bottom - a[1]],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  if (t0 > t1) return null;
  return [
    [a[0] + d[0] * t0, a[1] + d[1] * t0],
    [a[0] + d[0] * t1, a[1] + d[1] * t1],
  ];
}

/** Ray diagram for a lens or mirror: the image is computed from f and u, then two principal rays. */
export function compileOptics(action, { box }) {
  const isMirror = action.kind === 'mirror';
  const shape = action.shape === 'concave' ? 'concave' : 'convex';
  const f = action.f ?? 10;
  const u = action.u ?? 30;
  const h = action.h ?? 2;
  const fs = isMirror ? (shape === 'concave' ? -f : f) : shape === 'concave' ? -f : f;
  const image = isMirror ? mirrorImage(f, u, shape) : lensImage(fs, u);
  const shown = Number.isFinite(image.v) && Math.abs(image.v) < 8 * Math.max(u, 2 * f);
  const imageH = shown ? image.m * h : 0;

  const marks = isMirror
    ? [
        [fs, 'F'],
        [2 * fs, 'C'],
      ]
    : [
        [f, 'F'],
        [2 * f, '2F'],
        [-f, 'F'],
        [-2 * f, '2F'],
      ];
  const xs = [-u, 0, ...marks.map(([x]) => x), ...(shown ? [image.v] : [])];
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const padX = (maxX - minX) * 0.08 || 1;
  const rect = {
    left: box.x + 4,
    right: box.x + box.w - 4,
    top: box.y + 4,
    bottom: box.y + box.h - 4,
  };
  const axisY = box.y + box.h / 2;
  const halfH = box.h / 2 - 40;
  const scaleY = halfH / Math.max(Math.abs(h), Math.abs(imageH), 1);
  const X = (x) => box.x + 20 + ((x - minX + padX) / (maxX - minX + padX * 2)) * (box.w - 40);
  const P = ([x, y]) => [X(x), axisY - y * scaleY];

  const parts = [{ type: 'line', from: [rect.left, axisY], to: [rect.right, axisY], color: 'ink' }];

  // The lens or mirror itself, at x = 0.
  const x0 = X(0);
  const top = axisY - halfH - 10;
  const bottom = axisY + halfH + 10;
  const curve = (bulge, steps = 16) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const y = top + ((bottom - top) * i) / steps;
      const t = (y - axisY) / (bottom - axisY);
      return [x0 + bulge * (1 - t * t), y];
    });
  if (isMirror) {
    parts.push({
      type: 'path',
      points: curve(shape === 'concave' ? 10 : -10),
      color: 'blue',
      width: 6,
    });
  } else if (shape === 'convex') {
    parts.push({
      type: 'path',
      points: [...curve(10), ...curve(-10).reverse()],
      color: 'blue',
      closed: true,
    });
  } else {
    const edge = 12;
    const right = curve(-edge + 4).map(([x, y]) => [x + edge, y]);
    const leftSide = curve(edge - 4)
      .map(([x, y]) => [x - edge, y])
      .reverse();
    parts.push({ type: 'path', points: [...right, ...leftSide], color: 'blue', closed: true });
  }

  for (const [x, text] of marks) {
    const sx = X(x);
    if (sx < rect.left || sx > rect.right) continue;
    parts.push({ type: 'line', from: [sx, axisY - 6], to: [sx, axisY + 6], color: 'ink' });
    parts.push(label(text, sx, axisY + 30));
  }

  // Rays from the tip of the object.
  const tip = [-u, h];
  const hit = [0, h];
  const centre = [0, 0];
  const focus = [fs, 0];
  const ray = (from, through, extra = {}) => {
    const [a, b] = [P(from), P(through)];
    const far = [a[0] + (b[0] - a[0]) * 50, a[1] + (b[1] - a[1]) * 50];
    const segment = clip(a, far, rect);
    if (segment) parts.push({ type: 'path', points: segment, color: 'orange', ...extra });
  };
  const segmentTo = (from, to, extra = {}) => {
    const segment = clip(P(from), P(to), rect);
    if (segment) parts.push({ type: 'path', points: segment, color: 'orange', ...extra });
  };

  segmentTo(tip, hit);
  segmentTo(tip, centre);
  const converging = isMirror ? shape === 'concave' : shape === 'convex';
  if (isMirror) {
    // Parallel ray reflects through (or as if from) F; the ray to the pole reflects symmetrically.
    if (converging) ray(hit, focus);
    else ray(hit, [2 * hit[0] - focus[0], 2 * hit[1] - focus[1]]);
    ray(centre, [-u, -h]);
  } else {
    if (converging) ray(hit, focus);
    else ray(hit, [2 * hit[0] - focus[0], 2 * hit[1] - focus[1]]);
    ray(centre, [u, -h]);
  }
  if (shown && !image.real) {
    const dashed = { dash: true, color: 'orange' };
    segmentTo(hit, [image.v, imageH], dashed);
    segmentTo(centre, [image.v, imageH], dashed);
  }

  // Object and image arrows.
  const [ox, oy] = P(tip);
  parts.push({ type: 'arrow', from: [ox, axisY], to: [ox, oy], color: 'green' });
  parts.push(label('Object', ox, h >= 0 ? oy - 10 : oy + 30, { color: 'green' }));
  if (shown) {
    const [ix, iy] = P([image.v, imageH]);
    const inside = ix >= rect.left && ix <= rect.right;
    if (inside && image.real)
      parts.push({ type: 'arrow', from: [ix, axisY], to: [ix, iy], color: 'red' });
    if (inside && !image.real) {
      parts.push({
        type: 'path',
        points: [
          [ix, axisY],
          [ix, iy],
        ],
        color: 'red',
        dash: true,
      });
      parts.push({ type: 'dot', x: ix, y: iy, r: 5, color: 'red' });
    }
    if (inside) parts.push(label('Image', ix, imageH >= 0 ? iy - 10 : iy + 30, { color: 'red' }));
  }
  return parts;
}
