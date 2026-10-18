import { compileExpr, isMathReady, loadMath, sampleFunction } from './expr';

beforeAll(() => loadMath());

describe('compileExpr', () => {
  it('evaluates powers, implicit multiplication and functions', () => {
    expect(isMathReady()).toBe(true);
    expect(compileExpr('x^2')(3)).toBe(9);
    expect(compileExpr('2x+1')(2)).toBe(5);
    expect(compileExpr('sin(pi/2)')(0)).toBeCloseTo(1);
    expect(compileExpr('ln(e)')(0)).toBeCloseTo(1);
    expect(compileExpr('log10(x)')(100)).toBeCloseTo(2);
  });

  it('returns NaN outside the real domain', () => {
    expect(compileExpr('sqrt(x)')(-1)).toBeNaN();
    expect(compileExpr('ln(x)')(-1)).toBeNaN();
    expect(compileExpr('1/x')(0)).toBeNaN();
  });

  it.each([
    'import("fs")',
    'x.constructor',
    'f(x)=x',
    '[1,2]',
    'a=1',
    'evaluate("1")',
    'x ? 1 : 2',
    '1:3',
    'y + 1',
    '"text"',
    'x^^2',
    '',
  ])('rejects %j', (source) => {
    expect(compileExpr(source)).toBeNull();
  });
});

describe('sampleFunction', () => {
  it('samples a smooth curve as one segment', () => {
    const segments = sampleFunction(compileExpr('x'), [0, 1]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(241);
    expect(segments[0][240]).toEqual([1, 1]);
  });

  it('breaks the curve at asymptotes', () => {
    expect(sampleFunction(compileExpr('1/x'), [-2, 2]).length).toBeGreaterThanOrEqual(2);
    expect(sampleFunction(compileExpr('tan(x)'), [-3, 3]).length).toBeGreaterThanOrEqual(2);
  });

  it('skips points where the function is undefined', () => {
    const segments = sampleFunction(compileExpr('sqrt(x)'), [-1, 1], 20);
    expect(segments).toHaveLength(1);
    expect(segments[0].every(([x]) => x >= 0)).toBe(true);
  });
});
