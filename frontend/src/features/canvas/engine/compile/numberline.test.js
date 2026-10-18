import { compileNumberLine } from './numberline';
import { assertInBox, measure } from './testUtils';

const box = { x: 920, y: 100, w: 620, h: 140 };

describe('compileNumberLine', () => {
  it('marks an interval with open and closed ends', () => {
    const parts = compileNumberLine(
      { type: 'numberline', range: [-5, 5], interval: { from: -2, to: 3, open: [true, false] } },
      { box, measure }
    );
    const ends = parts.filter((part) => part.type === 'dot');
    expect(ends.map((dot) => Boolean(dot.hollow))).toEqual([true, false]);
    expect(parts.some((part) => part.type === 'path' && part.width > 4)).toBe(true);
    assertInBox(parts, box);
  });

  it('draws an unbounded inequality as a ray, not a closed end', () => {
    const parts = compileNumberLine(
      { type: 'numberline', range: [-5, 5], interval: { from: 3, to: 100, open: [true, false] } },
      { box, measure }
    );
    const dots = parts.filter((part) => part.type === 'dot');
    expect(dots).toHaveLength(1);
    expect(dots[0].hollow).toBe(true);
    const ray = parts.find((part) => part.type === 'arrow' && part.color === 'blue');
    expect(ray.to[0]).toBeGreaterThan(dots[0].x);
    assertInBox(parts, box);
  });

  it('draws ticks with labels, marks and named points', () => {
    const parts = compileNumberLine(
      { type: 'numberline', range: [0, 10], marks: [3], labels: { P: 7 } },
      { box, measure }
    );
    const texts = parts.filter((part) => part.type === 'label').map((part) => part.text);
    expect(texts).toEqual(expect.arrayContaining(['0', '10', 'P']));
    expect(parts.filter((part) => part.type === 'dot')).toHaveLength(2);
    assertInBox(parts, box);
  });
});
