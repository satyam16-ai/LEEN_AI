import { loadMath } from '../math/expr';
import { compilePlot, formatNumber } from './plot';
import { assertInBox, measure, STAGE_BOX } from './testUtils';

const ctx = { box: STAGE_BOX, measure };
const paths = (parts) => parts.filter((part) => part.type === 'path');
const curves = (parts) => paths(parts).filter((part) => !part.fill && part.points.length > 20);
const labels = (parts) => parts.filter((part) => part.type === 'label').map((part) => part.text);

beforeAll(() => loadMath());

describe('compilePlot', () => {
  it('draws axes, one curve and tick labels for y=x^2', () => {
    const parts = compilePlot({ type: 'plot', fns: ['x^2'], x: [-3, 3] }, ctx);

    expect(parts.filter((part) => part.type === 'arrow')).toHaveLength(2);
    expect(curves(parts)).toHaveLength(1);
    expect(curves(parts)[0].points.length).toBeGreaterThanOrEqual(100);
    expect(labels(parts)).toContain('2');
    assertInBox(parts, STAGE_BOX);
  });

  it('splits curves at asymptotes for 1/x and tan(x)', () => {
    for (const fn of ['1/x', 'tan(x)']) {
      const parts = compilePlot({ type: 'plot', fns: [fn], x: [-3, 3] }, ctx);
      expect(curves(parts).length).toBeGreaterThanOrEqual(2);
      assertInBox(parts, STAGE_BOX);
    }
  });

  it('keeps huge values inside the box', () => {
    const parts = compilePlot({ type: 'plot', fns: ['exp(x)'], x: [-10, 10] }, ctx);
    expect(curves(parts).length).toBeGreaterThanOrEqual(1);
    assertInBox(parts, STAGE_BOX);
  });

  it('auto-scales y when omitted and respects an explicit y', () => {
    const auto = compilePlot({ type: 'plot', fns: ['x^2'], x: [-3, 3] }, ctx);
    expect(labels(auto)).toContain('8');
    const fixed = compilePlot({ type: 'plot', fns: ['x^2'], x: [-3, 3], y: [0, 100] }, ctx);
    expect(labels(fixed)).toContain('100');
    expect(labels(fixed)).not.toContain('8');
  });

  it('skips invalid expressions but still draws axes', () => {
    const parts = compilePlot({ type: 'plot', fns: ['x^^2'] }, ctx);
    expect(parts.filter((part) => part.type === 'arrow')).toHaveLength(2);
    expect(curves(parts)).toHaveLength(0);
  });

  it('shades the area between from and to', () => {
    const parts = compilePlot(
      { type: 'plot', fns: ['x^2'], x: [-3, 3], shade: { fn: 0, from: 0, to: 2 } },
      ctx
    );
    const shaded = paths(parts).filter((part) => part.fill);
    expect(shaded).toHaveLength(1);
    expect(shaded[0].closed).toBe(true);
    assertInBox(parts, STAGE_BOX);
  });

  it('marks named points and labels curves and axes', () => {
    const parts = compilePlot(
      {
        type: 'plot',
        fns: ['x^2-4'],
        x: [-4, 4],
        points: { A: [-2, 0], B: [2, 0] },
        labels: ['y=x^2-4'],
        xlabel: 't (s)',
        ylabel: 'v (m/s)',
      },
      ctx
    );
    expect(parts.filter((part) => part.type === 'dot')).toHaveLength(2);
    expect(labels(parts)).toEqual(
      expect.arrayContaining(['A', 'B', 'y=x^2-4', 't (s)', 'v (m/s)'])
    );
    assertInBox(parts, STAGE_BOX);
  });

  it('draws every curve in its own colour', () => {
    const parts = compilePlot({ type: 'plot', fns: ['x', '2x', 'x^2'], x: [-2, 2] }, ctx);
    expect(new Set(curves(parts).map((part) => part.color))).toEqual(
      new Set(['blue', 'red', 'green'])
    );
  });
});

describe('formatNumber', () => {
  it('keeps four significant digits and uses a real minus sign', () => {
    expect(formatNumber(1 / 3)).toBe('0.3333');
    expect(formatNumber(2.5)).toBe('2.5');
    expect(formatNumber(-4)).toBe('−4');
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(12345)).toBe('12350');
  });
});
