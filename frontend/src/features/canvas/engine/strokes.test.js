import {
  eraserPath,
  mulberry32,
  partialPath,
  pathLength,
  rectStrokes,
  wobblyLine,
} from './strokes';

describe('hand-drawn strokes', () => {
  it('are identical for the same seed, so replays match', () => {
    const first = rectStrokes(100, 100, 300, 200, mulberry32(7));
    const second = rectStrokes(100, 100, 300, 200, mulberry32(7));
    const other = rectStrokes(100, 100, 300, 200, mulberry32(8));

    expect(second).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('wobble a little but start and end where asked', () => {
    const points = wobblyLine([0, 0], [400, 0], mulberry32(1));

    expect(points[0][0]).toBeCloseTo(0);
    expect(points[0][1]).toBeCloseTo(0);
    expect(points.at(-1)[0]).toBeCloseTo(400);
    expect(points.at(-1)[1]).toBeCloseTo(0);
    expect(Math.max(...points.map(([, y]) => Math.abs(y)))).toBeLessThan(3);
  });
});

describe('partialPath', () => {
  const path = [
    [0, 0],
    [100, 0],
    [100, 100],
  ];

  it('cuts a path at a fraction of its length', () => {
    expect(pathLength(path)).toBe(200);
    expect(partialPath(path, 0.25)).toEqual([
      [0, 0],
      [50, 0],
    ]);
    expect(partialPath(path, 0.75)).toEqual([
      [0, 0],
      [100, 0],
      [100, 50],
    ]);
    expect(partialPath(path, 1)).toBe(path);
  });
});

describe('eraserPath', () => {
  it('sweeps back and forth over the whole area', () => {
    const points = eraserPath(10, 20, 200, 100, 50);
    const ys = points.map(([, y]) => y);

    expect(Math.min(...ys)).toBe(20);
    expect(Math.max(...ys)).toBe(120);
    expect(points[0]).toEqual([10, 20]);
    expect(points[1]).toEqual([210, 20]);
    expect(points[2]).toEqual([210, 55]);
  });
});
