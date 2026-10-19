import { COMPILERS, expandAction, isCompiled } from './engine/compile';
import { STAGE } from './engine/board';
import { loadMath } from './engine/math/expr';
import { SAMPLES } from './samples';
import { measure } from './engine/compile/testUtils';

const V1 = [
  'caption',
  'write',
  'underline',
  'box',
  'erase',
  'line',
  'arrow',
  'rect',
  'circle',
  'clear',
  'pause',
  'object',
  'animate',
  'stop',
  'remove',
];
// Phase 5: questions the student answers, and the board's marks on written work.
const QUESTIONS = ['ask', 'answer', 'mark', 'verdict'];
const KNOWN = new Set([...V1, ...Object.keys(COMPILERS), 'scene', 'column', 'focus', ...QUESTIONS]);

beforeAll(() => loadMath());

describe('canvas samples', () => {
  it('cover every visual', () => {
    const used = new Set(SAMPLES.flatMap((sample) => sample.actions.map((action) => action.type)));
    for (const type of Object.keys(COMPILERS)) expect(used).toContain(type);
    expect(new Set(SAMPLES.map((sample) => sample.id)).size).toBe(SAMPLES.length);
  });

  it.each(SAMPLES.map((sample) => [sample.id, sample]))(
    '%s uses only known action types and every visual draws',
    (_, sample) => {
      for (const action of sample.actions) {
        expect(KNOWN).toContain(action.type);
        if (!isCompiled(action.type)) continue;
        const box = { x: STAGE.x, y: STAGE.y, w: STAGE.w, h: 380 };
        expect(expandAction(action, { box, measure }).length).toBeGreaterThan(0);
      }
    }
  );
});
