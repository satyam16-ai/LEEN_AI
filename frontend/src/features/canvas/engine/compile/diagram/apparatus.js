import { label } from './labels';

function outline(item, x, y, w, h) {
  const cx = x + w / 2;
  const bottom = y + h;
  const path = (points, extra = {}) => ({ type: 'path', points, color: 'ink', ...extra });
  switch (item) {
    case 'beaker': {
      const bw = Math.min(w * 0.7, h * 0.7);
      const [l, r, t] = [cx - bw / 2, cx + bw / 2, bottom - bw * 1.1];
      return [
        path([
          [l - 8, t],
          [l, t + 8],
          [l, bottom],
          [r, bottom],
          [r, t],
        ]),
        ...[0.3, 0.5, 0.7].map((k) =>
          path([
            [r - 18, t + (bottom - t) * k],
            [r - 4, t + (bottom - t) * k],
          ])
        ),
      ];
    }
    case 'test_tube': {
      const tw = Math.min(w * 0.22, 36);
      const t = y + h * 0.1;
      const turn = Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI - (Math.PI * i) / 8;
        return [cx + Math.cos(a) * (tw / 2), bottom - tw / 2 + Math.sin(a) * (tw / 2)];
      });
      return [path([[cx - tw / 2, t], ...turn, [cx + tw / 2, t]])];
    }
    case 'flask': {
      const fw = Math.min(w * 0.8, h * 0.75);
      const neck = y + h * 0.15;
      const shoulder = y + h * 0.4;
      return [
        path([
          [cx - 9, neck],
          [cx - 9, shoulder],
          [cx - fw / 2, bottom],
          [cx + fw / 2, bottom],
          [cx + 9, shoulder],
          [cx + 9, neck],
        ]),
      ];
    }
    case 'burner': {
      const bw = Math.min(w * 0.6, 90);
      const tubeTop = y + h * 0.45;
      return [
        { type: 'rect', x: cx - bw / 2, y: bottom - 14, w: bw, h: 14, color: 'ink' },
        { type: 'rect', x: cx - 9, y: tubeTop, w: 18, h: bottom - 14 - tubeTop, color: 'ink' },
        path(
          [
            [cx - 12, tubeTop - 4],
            [cx - 6, tubeTop - 40],
            [cx, tubeTop - 70],
            [cx + 6, tubeTop - 40],
            [cx + 12, tubeTop - 4],
          ],
          { color: 'orange', closed: true, fill: true }
        ),
      ];
    }
    default: {
      // stand
      const sw = Math.min(w * 0.8, 140);
      const rod = cx - sw * 0.3;
      const clamp = y + h * 0.3;
      return [
        { type: 'rect', x: cx - sw / 2, y: bottom - 12, w: sw, h: 12, color: 'ink' },
        path([
          [rod, bottom - 12],
          [rod, y + h * 0.05],
        ]),
        path([
          [rod, clamp],
          [cx + sw * 0.2, clamp],
        ]),
        { type: 'rect', x: cx + sw * 0.2, y: clamp - 10, w: 16, h: 20, color: 'ink' },
      ];
    }
  }
}

/** Lab apparatus outlines side by side, each named underneath. */
export function compileApparatus(action, { box }) {
  const items = action.items?.length ? action.items : ['beaker'];
  const slot = box.w / items.length;
  const height = box.h - 44;
  return items.flatMap((item, i) => {
    const x = box.x + slot * i;
    return [
      ...outline(item, x + 8, box.y + 8, slot - 16, height - 8),
      label(item.replace('_', ' '), x + slot / 2, box.y + box.h - 10),
    ];
  });
}
