import { layoutMathText, parseMathText, speakableText } from './mathText';

describe('parseMathText', () => {
  it('splits superscripts and subscripts', () => {
    expect(parseMathText('(x+y)^2 = x^2 + 2xy')).toEqual([
      { text: '(x+y)', script: 'base' },
      { text: '2', script: 'sup' },
      { text: ' = x', script: 'base' },
      { text: '2', script: 'sup' },
      { text: ' + 2xy', script: 'base' },
    ]);
  });

  it('reads braces, signed numbers and single characters', () => {
    expect(parseMathText('a^{n+1}')).toEqual([
      { text: 'a', script: 'base' },
      { text: 'n+1', script: 'sup' },
    ]);
    expect(parseMathText('x^-12y')).toEqual([
      { text: 'x', script: 'base' },
      { text: '-12', script: 'sup' },
      { text: 'y', script: 'base' },
    ]);
    expect(parseMathText('a_1 + a_{n}')).toEqual([
      { text: 'a', script: 'base' },
      { text: '1', script: 'sub' },
      { text: ' + a', script: 'base' },
      { text: 'n', script: 'sub' },
    ]);
  });

  it('leaves markers alone when there is nothing to attach them to', () => {
    expect(parseMathText('^ and x^')).toEqual([{ text: '^ and x^', script: 'base' }]);
  });
});

describe('layoutMathText', () => {
  const measure = (text, size) => text.length * size * 0.5;

  it('positions every glyph, with smaller raised exponents', () => {
    const { glyphs, width } = layoutMathText('x^2', 40, measure);

    expect(glyphs.map((g) => g.char)).toEqual(['x', '2']);
    expect(glyphs[0]).toMatchObject({ x: 0, dy: 0, size: 40, width: 20 });
    expect(glyphs[1].x).toBe(20);
    expect(glyphs[1].size).toBeLessThan(40);
    expect(glyphs[1].dy).toBeLessThan(0);
    expect(width).toBeCloseTo(20 + glyphs[1].width);
  });
});

describe('speakableText', () => {
  it('reads maths the way a teacher says it', () => {
    expect(speakableText('(x+y)^2 = x^2 + 2xy + y^2')).toBe(
      '(x plus y) whole squared equals x squared plus 2 x y plus y squared'
    );
    expect(speakableText('6 × 3 ÷ 2 = 9')).toBe('6 times 3 divided by 2 equals 9');
    expect(speakableText('a^{n+1}, a_1 and x^3')).toBe(
      'a to the power n plus 1, a sub 1 and x cubed'
    );
  });

  it('only treats a hyphen as minus between numbers or variables', () => {
    expect(speakableText('x - y = 3-2, step-by-step on the x-axis')).toBe(
      'x minus y equals 3 minus 2, step-by-step on the x-axis'
    );
  });

  it('spells out variables but leaves words alone', () => {
    expect(speakableText('Each piece has area xy, by 2nd step 3ab')).toBe(
      'Each piece has area x y, by 2nd step 3 a b'
    );
  });
});
