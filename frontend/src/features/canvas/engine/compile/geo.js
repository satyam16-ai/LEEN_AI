import { LABEL_PX } from '../board';

const PAD = 50;
const ARC_RADIUS = 34;
const ARC_LABEL = 60;
const RIGHT_MARK = 22;
const POINT_LABEL = 22;
const SIDE_LABEL = 26;
const NAME = /[A-Z][0-9']?/g;

const names = (text) => (typeof text === 'string' ? (text.match(NAME) ?? []) : []);
const unit = ([x, y]) => {
  const length = Math.hypot(x, y);
  return length ? [x / length, y / length] : [0, -1];
};

/** The angle a–vertex–b in degrees, rounded to one decimal place. */
export function angleDegrees(a, vertex, b) {
  const u = [a[0] - vertex[0], a[1] - vertex[1]];
  const v = [b[0] - vertex[0], b[1] - vertex[1]];
  const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
  return Math.round((Math.acos(Math.min(1, Math.max(-1, cos))) * 1800) / Math.PI) / 10;
}

const degreesText = (value) => `${String(value).replace(/\.0$/, '')}°`;

/** Fit maths coordinates (y up) into the box, keeping proportions. */
function fitter(points, radii, box) {
  const xs = points.flatMap(([x], i) => [x - radii[i], x + radii[i]]);
  const ys = points.flatMap(([, y], i) => [y - radii[i], y + radii[i]]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const scale = Math.min(
    (box.w - PAD * 2) / Math.max(maxX - minX, 1e-6),
    (box.h - PAD * 2) / Math.max(maxY - minY, 1e-6)
  );
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return {
    scale,
    toScreen: ([x, y]) => [
      cx + (x - (minX + maxX) / 2) * scale,
      cy - (y - (minY + maxY) / 2) * scale,
    ],
  };
}

/** A geometry construction: points, segments, polygons, circles, angle marks and labels. */
export function compileGeo(action, { box }) {
  const pts = Object.entries(action.pts ?? {}).filter(
    ([, point]) => Array.isArray(point) && point.every(Number.isFinite)
  );
  if (pts.length < 2) return [];
  const math = Object.fromEntries(pts);
  const color = action.color ?? 'ink';

  const circles = (action.circles ?? [])
    .map((circle) => {
      const centre = math[circle.c];
      const through = math[circle.through];
      const r = circle.r ?? (through && Math.hypot(through[0] - centre[0], through[1] - centre[1]));
      return centre && r > 0 ? { centre, r } : null;
    })
    .filter(Boolean);
  const { scale, toScreen } = fitter(
    [...pts.map(([, point]) => point), ...circles.map((circle) => circle.centre)],
    [...pts.map(() => 0), ...circles.map((circle) => circle.r)],
    box
  );
  const screen = Object.fromEntries(pts.map(([name, point]) => [name, toScreen(point)]));
  const centroid = Object.values(screen)
    .reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0])
    .map((sum) => sum / pts.length);
  const away = ([x, y], distance) => {
    const [ux, uy] = unit([x - centroid[0], y - centroid[1]]);
    return [x + ux * distance, y + uy * distance];
  };
  const label = (text, [x, y], extra = {}) => ({
    type: 'label',
    text,
    x,
    y: y + LABEL_PX / 3,
    px: LABEL_PX,
    color,
    align: 'center',
    ...extra,
  });

  const parts = [];
  for (const shape of action.shapes ?? []) {
    const corners = names(shape).map((name) => screen[name]);
    if (corners.length < 2 || corners.some((corner) => !corner)) continue;
    parts.push(
      corners.length === 2
        ? { type: 'path', points: corners, color }
        : { type: 'path', points: corners, color, closed: true }
    );
  }
  for (const { centre, r } of circles) {
    const [x, y] = toScreen(centre);
    parts.push({ type: 'circle', x, y, r: r * scale, color });
  }
  for (const [name, point] of Object.entries(screen)) {
    parts.push({ type: 'dot', x: point[0], y: point[1], r: 5, color });
    parts.push(label(name, away(point, POINT_LABEL)));
  }

  for (const corner of action.right ?? []) {
    const [a, v, b] = names(corner).map((name) => screen[name]);
    if (!a || !v || !b) continue;
    const u1 = unit([a[0] - v[0], a[1] - v[1]]);
    const u2 = unit([b[0] - v[0], b[1] - v[1]]);
    parts.push({
      type: 'path',
      points: [
        [v[0] + u1[0] * RIGHT_MARK, v[1] + u1[1] * RIGHT_MARK],
        [v[0] + (u1[0] + u2[0]) * RIGHT_MARK, v[1] + (u1[1] + u2[1]) * RIGHT_MARK],
        [v[0] + u2[0] * RIGHT_MARK, v[1] + u2[1] * RIGHT_MARK],
      ],
      color: 'blue',
    });
  }
  for (const angle of action.angles ?? []) {
    const [na, nv, nb] = names(angle);
    const [a, v, b] = [screen[na], screen[nv], screen[nb]];
    if (!a || !v || !b) continue;
    const start = Math.atan2(a[1] - v[1], a[0] - v[0]);
    let sweep = Math.atan2(b[1] - v[1], b[0] - v[0]) - start;
    if (sweep > Math.PI) sweep -= Math.PI * 2;
    if (sweep < -Math.PI) sweep += Math.PI * 2;
    const arc = Array.from({ length: 13 }, (_, i) => {
      const t = start + (sweep * i) / 12;
      return [v[0] + Math.cos(t) * ARC_RADIUS, v[1] + Math.sin(t) * ARC_RADIUS];
    });
    parts.push({ type: 'path', points: arc, color: 'blue' });
    const middle = start + sweep / 2;
    const at = [v[0] + Math.cos(middle) * ARC_LABEL, v[1] + Math.sin(middle) * ARC_LABEL];
    const value = angleDegrees(math[na], math[nv], math[nb]);
    parts.push(label(degreesText(value), at, { color: 'blue' }));
  }
  for (const [side, text] of Object.entries(action.sides ?? {})) {
    const [p, q] = names(side).map((name) => screen[name]);
    if (!p || !q) continue;
    const middle = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    parts.push(label(text, away(middle, SIDE_LABEL), { color: 'green' }));
  }
  return parts;
}
