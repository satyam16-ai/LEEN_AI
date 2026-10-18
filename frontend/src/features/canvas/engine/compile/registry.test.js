import { COMPILERS, expandAction, isCompiled } from '.';
import { measure, STAGE_BOX } from './testUtils';

const ctx = { box: STAGE_BOX, measure };

describe('compile registry', () => {
  it('knows which actions are compiled visuals', () => {
    for (const type of ['plot', 'numberline', 'geo', 'table', 'chart', 'flow', 'diagram']) {
      expect(isCompiled(type)).toBe(true);
    }
    expect(isCompiled('write')).toBe(false);
    expect(isCompiled('toString')).toBe(false);
  });

  it.each(Object.keys(COMPILERS))('%s returns an array for empty input', (type) => {
    expect(Array.isArray(expandAction({ type }, ctx))).toBe(true);
  });

  it('never throws when a compiler fails', () => {
    const original = COMPILERS.plot;
    COMPILERS.plot = () => {
      throw new Error('boom');
    };
    try {
      expect(expandAction({ type: 'plot' }, ctx)).toEqual([]);
    } finally {
      COMPILERS.plot = original;
    }
  });
});
