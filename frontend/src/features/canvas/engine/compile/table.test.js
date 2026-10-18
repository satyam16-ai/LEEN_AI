import { loadMath } from '../math/expr';
import { compileTable } from './table';
import { assertInBox, measure, STAGE_BOX } from './testUtils';

const texts = (parts) => parts.filter((part) => part.type === 'label').map((part) => part.text);

beforeAll(() => loadMath());

describe('compileTable', () => {
  it('fills a table of values from fn', () => {
    const parts = compileTable(
      { type: 'table', fn: 'x^2', xs: [-2, 0, 2] },
      { box: STAGE_BOX, measure }
    );
    expect(texts(parts)).toEqual(['x', 'x^2', '−2', '4', '0', '0', '2', '4']);
    assertInBox(parts, STAGE_BOX);
  });

  it('writes given rows under the head, row by row', () => {
    const parts = compileTable(
      {
        type: 'table',
        head: ['Metal', 'With water'],
        rows: [
          ['Na', 'fast'],
          ['Mg', 'slow'],
        ],
      },
      { box: STAGE_BOX, measure }
    );
    expect(texts(parts)).toEqual(['Metal', 'With water', 'Na', 'fast', 'Mg', 'slow']);
    const firstCell = parts.findIndex((part) => part.text === 'Na');
    const secondRowLine = parts.findIndex(
      (part, index) => index > firstCell && part.type === 'path'
    );
    expect(secondRowLine).toBeGreaterThan(firstCell);
  });

  it('shrinks text to fit a narrow box', () => {
    const box = { x: 920, y: 100, w: 300, h: 200 };
    const rows = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 6 }, (_, c) => `long cell text ${r}${c}`)
    );
    const parts = compileTable({ type: 'table', rows }, { box, measure });
    const sizes = parts.filter((part) => part.type === 'label').map((part) => part.px);
    expect(Math.max(...sizes)).toBeLessThan(26);
    assertInBox(parts, box);
  });

  it('draws nothing without rows', () => {
    expect(compileTable({ type: 'table' }, { box: STAGE_BOX, measure })).toEqual([]);
  });
});
