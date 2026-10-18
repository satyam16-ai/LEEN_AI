import { compileFlow } from './flow';
import { assertInBox, measure, STAGE_BOX } from './testUtils';

const ctx = { box: STAGE_BOX, measure };
const labelsOf = (parts) => parts.filter((part) => part.type === 'label');

describe('compileFlow', () => {
  it('chains nodes when edges are omitted', () => {
    const parts = compileFlow({ type: 'flow', nodes: ['a', 'b', 'c', 'd'] }, ctx);
    expect(parts.filter((part) => part.type === 'arrow')).toHaveLength(3);
    expect(parts.filter((part) => part.type === 'rect')).toHaveLength(4);
    assertInBox(parts, STAGE_BOX);
  });

  it('follows explicit edges', () => {
    const parts = compileFlow(
      {
        type: 'flow',
        nodes: ['root', 'left', 'right'],
        edges: [
          [0, 1],
          [0, 2],
        ],
      },
      ctx
    );
    expect(parts.filter((part) => part.type === 'arrow')).toHaveLength(2);
  });

  it('LR layout places nodes left to right', () => {
    const parts = compileFlow(
      { type: 'flow', nodes: ['Sunlight', 'Leaf', 'Glucose'], dir: 'LR' },
      ctx
    );
    const xs = labelsOf(parts).map((label) => label.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    assertInBox(parts, STAGE_BOX);
  });

  it('mind map puts the first node in the centre', () => {
    const parts = compileFlow(
      { type: 'flow', kind: 'mind', nodes: ['Photosynthesis', 'Light', 'Water', 'CO2', 'Glucose'] },
      ctx
    );
    const centre = labelsOf(parts).find((label) => label.text === 'Photosynthesis');
    expect(centre.x).toBeCloseTo(STAGE_BOX.x + STAGE_BOX.w / 2, 0);
    expect(parts.filter((part) => part.type === 'line')).toHaveLength(4);
    assertInBox(parts, STAGE_BOX);
  });

  it('long node text still fits the box', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => `A rather long step number ${i}`);
    for (const dir of ['TB', 'LR']) {
      assertInBox(compileFlow({ type: 'flow', nodes, dir }, ctx), STAGE_BOX);
    }
    assertInBox(compileFlow({ type: 'flow', kind: 'mind', nodes }, ctx), STAGE_BOX);
  });

  it('one node draws nothing', () => {
    expect(compileFlow({ type: 'flow', nodes: ['alone'] }, ctx)).toEqual([]);
    expect(compileFlow({ type: 'flow' }, ctx)).toEqual([]);
  });
});
