import { compileChart } from './chart';
import { assertInBox, measure, STAGE_BOX } from './testUtils';

const ctx = { box: STAGE_BOX, measure };

describe('compileChart', () => {
  it('bar heights are proportional to the values', () => {
    const parts = compileChart(
      { type: 'chart', kind: 'bar', labels: ['A', 'B'], values: [2, 4], title: 'Marks' },
      ctx
    );
    const bars = parts.filter((part) => part.type === 'rect');
    expect(bars).toHaveLength(2);
    expect(bars[1].h).toBeCloseTo(bars[0].h * 2, 0);
    expect(parts.some((part) => part.type === 'label' && part.text === 'Marks')).toBe(true);
    assertInBox(parts, STAGE_BOX);
  });

  it('pie slices cover the full circle', () => {
    const parts = compileChart(
      { type: 'chart', kind: 'pie', labels: ['a', 'b', 'c'], values: [1, 2, 3] },
      ctx
    );
    const slices = parts.filter((part) => part.type === 'path' && part.fill);
    expect(slices).toHaveLength(3);
    const total = slices.reduce((sum, slice) => sum + slice.span, 0);
    expect(total).toBeCloseTo(Math.PI * 2, 6);
    assertInBox(parts, STAGE_BOX);
  });

  it('line chart draws one path through every point', () => {
    const parts = compileChart(
      { type: 'chart', kind: 'line', labels: ['0', '2', '4', '6'], values: [0, 10, 20, 0] },
      ctx
    );
    const lines = parts.filter((part) => part.type === 'path');
    expect(lines).toHaveLength(1);
    expect(lines[0].points).toHaveLength(4);
    expect(parts.filter((part) => part.type === 'dot')).toHaveLength(4);
    assertInBox(parts, STAGE_BOX);
  });

  it('charts with no values draw nothing', () => {
    expect(compileChart({ type: 'chart', labels: [], values: [] }, ctx)).toEqual([]);
    expect(compileChart({ type: 'chart' }, ctx)).toEqual([]);
  });
});
