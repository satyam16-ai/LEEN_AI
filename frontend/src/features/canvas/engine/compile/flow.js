import { graphlib, layout } from '@dagrejs/dagre';

import { LABEL_PX } from '../board';
import { fitText } from './text';

const NODE_PAD_X = 28;
const NODE_PAD_Y = 22;
const MIN_PX = 12;

const label = (text, x, y, px, color) => ({
  type: 'label',
  text,
  x,
  y: y + px / 3,
  px,
  color,
  align: 'center',
});

/** Flowchart: dagre lays the nodes out, then the whole chart is scaled to fit the box. */
function chart(action, box, measure, dir = action.dir === 'LR' ? 'LR' : 'TB') {
  const px = LABEL_PX + 2;
  const graph = new graphlib.Graph();
  graph.setGraph({ rankdir: dir, nodesep: 30, ranksep: 40 });
  graph.setDefaultEdgeLabel(() => ({}));
  action.nodes.forEach((text, i) => {
    graph.setNode(String(i), { width: measure(text, px) + NODE_PAD_X, height: px + NODE_PAD_Y });
  });
  const count = action.nodes.length;
  const edges = action.edges?.length
    ? action.edges
    : Array.from({ length: count - 1 }, (_, i) => [i, i + 1]);
  for (const [from, to] of edges) {
    if (from >= 0 && to >= 0 && from < count && to < count && from !== to) {
      graph.setEdge(String(from), String(to));
    }
  }
  layout(graph);

  const { width, height } = graph.graph();
  const scale = Math.min(1, box.w / width, box.h / height);
  // A long left-to-right chain would shrink to unreadable; stack it top to bottom instead.
  if (dir === 'LR' && scale < 0.5) return chart(action, box, measure, 'TB');
  const offsetX = box.x + (box.w - width * scale) / 2;
  const offsetY = box.y + (box.h - height * scale) / 2;
  const at = ({ x, y }) => [offsetX + x * scale, offsetY + y * scale];
  const color = action.color ?? 'ink';
  const textPx = Math.max(MIN_PX, px * scale);

  const parts = [];
  action.nodes.forEach((text, i) => {
    const node = graph.node(String(i));
    const [cx, cy] = at(node);
    const w = node.width * scale;
    const h = node.height * scale;
    parts.push({ type: 'rect', x: cx - w / 2, y: cy - h / 2, w, h, color });
    parts.push(label(fitText(text, textPx, w - 6, measure), cx, cy, textPx, color));
  });
  for (const edge of graph.edges()) {
    const points = graph.edge(edge).points.map(at);
    if (points.length > 2) parts.push({ type: 'path', points: points.slice(0, -1), color: 'blue' });
    parts.push({ type: 'arrow', from: points.at(-2), to: points.at(-1), color: 'blue' });
  }
  return parts;
}

/** Where the segment from the centre of a w×h box towards `to` leaves the box. */
function exitPoint([x0, y0], [x1, y1], w, h) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = Math.min(1, w / 2 / Math.abs(dx || 1e-9), h / 2 / Math.abs(dy || 1e-9));
  return [x0 + dx * t, y0 + dy * t];
}

/** Mind map: node 0 in the middle, the others spaced evenly on an ellipse around it. */
function mind(action, box, measure) {
  const color = action.color ?? 'ink';
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const others = action.nodes.slice(1);
  let px = LABEL_PX + 2;
  const sizeOf = (text) => [measure(text, px) + NODE_PAD_X, px + NODE_PAD_Y];
  // Shrink the text until the widest outer node fits beside the centre.
  while (px > MIN_PX && Math.max(...others.map((text) => sizeOf(text)[0])) > box.w * 0.4) px -= 1;

  const place = (text, x, y) => {
    const [w, h] = sizeOf(text);
    const fitW = Math.min(w, box.w);
    const nx = Math.min(Math.max(x, box.x + fitW / 2), box.x + box.w - fitW / 2);
    const ny = Math.min(Math.max(y, box.y + h / 2), box.y + box.h - h / 2);
    return { x: nx, y: ny, w: fitW, h };
  };
  const centre = place(action.nodes[0], cx, cy);
  const parts = [];
  others.forEach((text, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / others.length;
    const node = place(
      text,
      cx + Math.cos(angle) * box.w * 0.4,
      cy + Math.sin(angle) * box.h * 0.38
    );
    // Spokes run between the box edges, so they never cross a label.
    const from = exitPoint([centre.x, centre.y], [node.x, node.y], centre.w + 6, centre.h + 6);
    const to = exitPoint([node.x, node.y], [centre.x, centre.y], node.w + 6, node.h + 6);
    parts.push({ type: 'line', from, to, color: 'blue' });
    parts.push({
      type: 'rect',
      x: node.x - node.w / 2,
      y: node.y - node.h / 2,
      w: node.w,
      h: node.h,
      color,
    });
    parts.push(label(fitText(text, px, node.w - 6, measure), node.x, node.y, px, color));
  });
  parts.push({
    type: 'rect',
    x: centre.x - centre.w / 2,
    y: centre.y - centre.h / 2,
    w: centre.w,
    h: centre.h,
    color: 'purple',
    fill: true,
  });
  parts.push(label(action.nodes[0], centre.x, centre.y, px, 'purple'));
  return parts;
}

/** A flowchart (kind "chart") or mind map (kind "mind") from node names and index-pair edges. */
export function compileFlow(action, { box, measure }) {
  if (!Array.isArray(action.nodes) || action.nodes.length < 2) return [];
  return action.kind === 'mind' ? mind(action, box, measure) : chart(action, box, measure);
}
