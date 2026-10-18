import { LABEL_PX } from '../board';
import { compileExpr } from '../math/expr';
import { formatNumber } from './plot';

const CELL_PAD = 24;
const MIN_PX = 14;
const ROW_HEIGHT = 1.9; // × font size

function rowsOf(action) {
  if (action.rows?.length) {
    return { head: action.head ?? [], rows: action.rows };
  }
  const xs = action.xs ?? [];
  if (!action.fn || !xs.length) return { head: [], rows: [] };
  const fn = compileExpr(action.fn);
  const value = (x) => {
    const y = fn ? fn(x) : NaN;
    return Number.isFinite(y) ? formatNumber(y) : '—';
  };
  return {
    head: action.head?.length ? action.head : ['x', action.fn],
    rows: xs.map((x) => [formatNumber(x), value(x)]),
  };
}

/** A grid table, revealed row by row; text shrinks (down to 14 px) to fit the box. */
export function compileTable(action, { box, measure }) {
  const { head, rows } = rowsOf(action);
  const all = head.length ? [head, ...rows] : rows;
  const columns = Math.max(0, ...all.map((row) => row.length));
  if (!rows.length || !columns) return [];

  const sizeAt = (px) => {
    const widths = Array.from(
      { length: columns },
      (_, c) => Math.max(...all.map((row) => measure(String(row[c] ?? ''), px))) + CELL_PAD
    );
    return { widths, rowH: px * ROW_HEIGHT };
  };
  let px = LABEL_PX + 2;
  let { widths, rowH } = sizeAt(px);
  const fits = () => widths.reduce((a, b) => a + b, 0) <= box.w && rowH * all.length <= box.h;
  while (!fits() && px > MIN_PX) {
    px -= 1;
    ({ widths, rowH } = sizeAt(px));
  }
  if (!fits()) {
    // Still too big at the smallest font: squeeze the grid into the box.
    const total = widths.reduce((a, b) => a + b, 0);
    widths = widths.map((width) => Math.min(width, (width * box.w) / total));
    rowH = Math.min(rowH, box.h / all.length);
  }

  const totalW = widths.reduce((a, b) => a + b, 0);
  const left = box.x + (box.w - totalW) / 2;
  const right = left + totalW;
  const edges = widths.reduce((xs, width) => [...xs, xs.at(-1) + width], [left]);
  const top = box.y;
  const color = action.color ?? 'ink';

  const parts = [
    {
      type: 'path',
      points: [
        [left, top],
        [right, top],
      ],
      color,
    },
  ];
  all.forEach((row, r) => {
    const y0 = top + r * rowH;
    const y1 = y0 + rowH;
    for (const x of edges)
      parts.push({
        type: 'path',
        points: [
          [x, y0],
          [x, y1],
        ],
        color,
      });
    parts.push({
      type: 'path',
      points: [
        [left, y1],
        [right, y1],
      ],
      color,
    });
    for (let c = 0; c < columns; c += 1) {
      parts.push({
        type: 'label',
        text: String(row[c] ?? ''),
        x: (edges[c] + edges[c + 1]) / 2,
        y: y0 + rowH * 0.68,
        px,
        color: head.length && r === 0 ? 'blue' : color,
        align: 'center',
      });
    }
  });
  return parts;
}
