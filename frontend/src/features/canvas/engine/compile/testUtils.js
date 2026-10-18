/** Assert that every drawn primitive stays inside `box` (give or take `slack` units). */
export function assertInBox(primitives, box, slack = 2) {
  const inside = ([x, y], what) => {
    const ok =
      x >= box.x - slack &&
      x <= box.x + box.w + slack &&
      y >= box.y - slack &&
      y <= box.y + box.h + slack;
    if (!ok) throw new Error(`${what} at (${x.toFixed(1)}, ${y.toFixed(1)}) is outside the box`);
  };
  for (const part of primitives) {
    switch (part.type) {
      case 'path':
        part.points.forEach((point) => inside(point, 'path point'));
        break;
      case 'label':
        inside([part.x, part.y], `label "${part.text}"`);
        break;
      case 'dot':
        inside([part.x - part.r, part.y - part.r], 'dot');
        inside([part.x + part.r, part.y + part.r], 'dot');
        break;
      case 'line':
      case 'arrow':
        inside(part.from, `${part.type} start`);
        inside(part.to, `${part.type} end`);
        break;
      case 'rect':
        inside([part.x, part.y], 'rect');
        inside([part.x + part.w, part.y + part.h], 'rect');
        break;
      case 'circle':
        inside([part.x - part.r, part.y - part.r], 'circle');
        inside([part.x + part.r, part.y + part.r], 'circle');
        break;
      default:
        throw new Error(`unknown primitive ${part.type}`);
    }
  }
}

export const STAGE_BOX = { x: 920, y: 100, w: 620, h: 400 };

/** Rough text width for tests: half the font size per character. */
export const measure = (text, px) => String(text).length * px * 0.5;
