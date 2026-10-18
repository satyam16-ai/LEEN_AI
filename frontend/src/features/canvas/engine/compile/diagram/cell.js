import { LABEL_PX } from '../../board';
import { leaderLabels } from './labels';

const PLANT_ONLY = new Set(['cell wall', 'chloroplast']);

function ellipse(cx, cy, rx, ry, wobble = 0, steps = 40) {
  return Array.from({ length: steps }, (_, i) => {
    const t = (Math.PI * 2 * i) / steps;
    const k = 1 + wobble * Math.sin(t * 5);
    return [cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k];
  });
}

/** An animal or plant cell with organelles at fixed places, labelled by leader lines. */
export function compileCell(action, { box, measure }) {
  const plant = action.cell === 'plant';
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w * 0.22;
  const ry = box.h * 0.42;
  const at = (fx, fy) => [cx + fx * rx, cy + fy * ry];
  const parts = [];
  const anchors = {};

  if (plant) {
    parts.push({ type: 'rect', x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2, color: 'green' });
    const inset = 8;
    parts.push({
      type: 'path',
      points: [
        [cx - rx + inset, cy - ry + inset],
        [cx + rx - inset, cy - ry + inset],
        [cx + rx - inset, cy + ry - inset],
        [cx - rx + inset, cy + ry - inset],
      ],
      color: 'ink',
      closed: true,
    });
    anchors['cell wall'] = [cx - rx, cy - ry * 0.4];
    anchors['cell membrane'] = [cx + rx - inset, cy + ry * 0.35];
    parts.push({
      type: 'path',
      points: ellipse(...at(0.15, 0.1), rx * 0.45, ry * 0.45),
      color: 'blue',
      closed: true,
      fill: true,
    });
    anchors.vacuole = at(0.15, 0.1);
    for (const [fx, fy] of [
      [-0.6, -0.6],
      [0.55, -0.7],
      [-0.6, 0.65],
    ]) {
      parts.push({
        type: 'path',
        points: ellipse(...at(fx, fy), rx * 0.16, ry * 0.08),
        color: 'green',
        closed: true,
        fill: true,
      });
    }
    anchors.chloroplast = at(-0.6, -0.6);
  } else {
    parts.push({ type: 'path', points: ellipse(cx, cy, rx, ry, 0.03), color: 'ink', closed: true });
    anchors['cell membrane'] = [cx, cy - ry];
    parts.push({
      type: 'circle',
      x: at(0.5, -0.45)[0],
      y: at(0.5, -0.45)[1],
      r: Math.min(rx, ry) * 0.1,
      color: 'blue',
    });
    anchors.vacuole = at(0.5, -0.45);
  }

  const [nx, ny] = at(-0.25, -0.2);
  const nucleusR = Math.min(rx, ry) * 0.24;
  parts.push({ type: 'circle', x: nx, y: ny, r: nucleusR, color: 'purple' });
  parts.push({ type: 'dot', x: nx, y: ny, r: nucleusR * 0.3, color: 'purple' });
  anchors.nucleus = [nx, ny];
  for (const [fx, fy] of [
    [0.4, 0.6],
    [-0.55, 0.3],
  ]) {
    parts.push({
      type: 'path',
      points: ellipse(...at(fx, fy), rx * 0.18, ry * 0.07),
      color: 'orange',
      closed: true,
    });
  }
  anchors.mitochondria = at(0.4, 0.6);
  for (const [fx, fy] of [
    [0.2, -0.55],
    [-0.1, 0.55],
    [0.65, 0.2],
    [-0.45, -0.75],
  ]) {
    parts.push({ type: 'dot', x: at(fx, fy)[0], y: at(fx, fy)[1], r: 3, color: 'ink' });
  }
  anchors.ribosome = at(0.2, -0.55);
  anchors.cytoplasm = at(-0.62, 0);

  const drawn = Object.keys(anchors).filter((name) => plant || !PLANT_ONLY.has(name));
  const wanted = action.labels?.length
    ? action.labels.filter((name) => drawn.includes(name))
    : drawn;
  const items = wanted.map((name) => ({ text: name, anchor: anchors[name] }));
  return [...parts, ...leaderLabels(items, box, measure, { px: Math.round(LABEL_PX * 0.85) })];
}
