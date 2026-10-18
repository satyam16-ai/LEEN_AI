import { wrapWords } from './wrap';

const widthOf = (text) => text.length * 10;

describe('wrapWords', () => {
  it('keeps short text on one line', () => {
    expect(wrapWords('x = ±2', 200, widthOf)).toEqual(['x = ±2']);
  });

  it('breaks long text at spaces so each line fits', () => {
    const lines = wrapWords('Far object → small, clear image on the other side', 200, widthOf);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(widthOf(line)).toBeLessThanOrEqual(200);
    expect(lines.join(' ')).toBe('Far object → small, clear image on the other side');
  });

  it('never splits inside a word', () => {
    expect(wrapWords('supercalifragilistic is long', 100, widthOf)).toEqual([
      'supercalifragilistic',
      'is long',
    ]);
  });
});
