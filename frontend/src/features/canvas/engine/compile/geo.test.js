import { angleDegrees, compileGeo } from './geo';
import { assertInBox, measure, STAGE_BOX } from './testUtils';

const ctx = { box: STAGE_BOX, measure };
const triangle = { A: [0, 0], B: [4, 0], C: [0, 3] };
const labelTexts = (parts) => parts.filter((part) => part.type === 'label').map((p) => p.text);

describe('angleDegrees', () => {
  it('measures the angles of a 3-4-5 triangle', () => {
    expect(angleDegrees([0, 3], [0, 0], [4, 0])).toBe(90);
    expect(angleDegrees([0, 0], [4, 0], [0, 3])).toBe(36.9);
    expect(angleDegrees([4, 0], [0, 3], [0, 0])).toBe(53.1);
  });
});

describe('compileGeo', () => {
  it('draws a closed triangle with point labels outside it', () => {
    const parts = compileGeo({ type: 'geo', pts: triangle, shapes: ['ABC'] }, ctx);

    const polygons = parts.filter((part) => part.type === 'path' && part.closed);
    expect(polygons).toHaveLength(1);
    expect(polygons[0].points.length).toBeGreaterThanOrEqual(3);
    expect(polygons[0].points.length).toBeLessThanOrEqual(4);

    const dots = parts.filter((part) => part.type === 'dot');
    const centre = dots.reduce(([sx, sy], d) => [sx + d.x / 3, sy + d.y / 3], [0, 0]);
    const distance = ([x, y]) => Math.hypot(x - centre[0], y - centre[1]);
    for (const name of ['A', 'B', 'C']) {
      const label = parts.find((part) => part.type === 'label' && part.text === name);
      const point = dots[['A', 'B', 'C'].indexOf(name)];
      expect(distance([label.x, label.y])).toBeGreaterThan(distance([point.x, point.y]));
    }
    assertInBox(parts, STAGE_BOX);
  });

  it('draws a segment for a two-point shape', () => {
    const parts = compileGeo({ type: 'geo', pts: triangle, shapes: ['AB'] }, ctx);
    const segments = parts.filter((part) => part.type === 'path' && !part.closed);
    expect(segments).toHaveLength(1);
    expect(segments[0].points).toHaveLength(2);
  });

  it('uses a right-angle square instead of an arc', () => {
    const parts = compileGeo({ type: 'geo', pts: triangle, shapes: ['ABC'], right: ['BAC'] }, ctx);
    const square = parts.filter(
      (part) => part.type === 'path' && !part.closed && part.points.length === 3
    );
    expect(square).toHaveLength(1);
    expect(labelTexts(parts)).not.toContain('90°');
  });

  it('labels an angle with its computed value', () => {
    const parts = compileGeo(
      { type: 'geo', pts: triangle, shapes: ['ABC'], angles: ['ABC', 'CAB'] },
      ctx
    );
    expect(labelTexts(parts)).toEqual(expect.arrayContaining(['36.9°', '90°']));
    assertInBox(parts, STAGE_BOX);
  });

  it('labels sides and draws circles', () => {
    const parts = compileGeo(
      {
        type: 'geo',
        pts: { O: [0, 0], A: [2, 0] },
        shapes: ['OA'],
        sides: { OA: 'r = 2 cm' },
        circles: [{ c: 'O', through: 'A' }],
      },
      ctx
    );
    expect(labelTexts(parts)).toContain('r = 2 cm');
    expect(parts.filter((part) => part.type === 'circle')).toHaveLength(1);
    assertInBox(parts, STAGE_BOX);
  });

  it('a single point draws nothing and does not throw', () => {
    expect(compileGeo({ type: 'geo', pts: { A: [1, 1] } }, ctx)).toEqual([]);
    expect(compileGeo({ type: 'geo' }, ctx)).toEqual([]);
  });
});
