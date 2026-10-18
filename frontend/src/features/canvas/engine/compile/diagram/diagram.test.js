import { assertInBox, measure } from '../testUtils';
import { compileDiagram } from '.';
import { shellConfig } from './atom';
import { lensImage, mirrorImage } from './optics';

const box = { x: 920, y: 100, w: 400, h: 300 };
const ctx = { box, measure };
const texts = (parts) => parts.filter((part) => part.type === 'label').map((part) => part.text);

describe('optics maths', () => {
  it('finds the image of a lens', () => {
    const far = lensImage(10, 30);
    expect(far.v).toBeCloseTo(15);
    expect(far.m).toBeCloseTo(-0.5);
    expect(far.real).toBe(true);

    const near = lensImage(10, 5);
    expect(near.v).toBeCloseTo(-10);
    expect(near.m).toBeCloseTo(2);
    expect(near.real).toBe(false);

    const concave = lensImage(-10, 30);
    expect(concave.v).toBeCloseTo(-7.5);
    expect(concave.m).toBeCloseTo(0.25);
    expect(concave.real).toBe(false);
  });

  it('finds the image of a mirror', () => {
    const concave = mirrorImage(10, 30, 'concave');
    expect(concave.v).toBeCloseTo(-15);
    expect(concave.m).toBeCloseTo(-0.5);
    expect(concave.real).toBe(true);

    const convex = mirrorImage(10, 30, 'convex');
    expect(convex.v).toBeGreaterThan(0);
    expect(convex.real).toBe(false);
  });
});

describe('shellConfig', () => {
  it('fills Bohr shells 2, 8, 8, 2', () => {
    expect(shellConfig(1)).toEqual([1]);
    expect(shellConfig(11)).toEqual([2, 8, 1]);
    expect(shellConfig(20)).toEqual([2, 8, 8, 2]);
  });
});

describe('compileDiagram', () => {
  it('series circuit labels every part', () => {
    const parts = compileDiagram(
      { type: 'diagram', kind: 'circuit', parts: ['battery 6V', 'resistor 4Ω', 'bulb'] },
      ctx
    );
    expect(texts(parts)).toEqual(expect.arrayContaining(['6V', '4Ω']));
    assertInBox(parts, box);
  });

  it('parallel circuit puts parts on separate branches', () => {
    const parts = compileDiagram(
      {
        type: 'diagram',
        kind: 'circuit',
        layout: 'parallel',
        parts: ['battery 9V', 'bulb L1', 'bulb L2', 'ammeter'],
      },
      ctx
    );
    expect(texts(parts)).toEqual(expect.arrayContaining(['9V', 'L1', 'L2', 'A']));
    assertInBox(parts, box);
  });

  it('fbd draws one arrow per force', () => {
    const parts = compileDiagram(
      {
        type: 'diagram',
        kind: 'fbd',
        forces: [
          { dir: 'down', label: 'mg', size: 2 },
          { dir: 'up', label: 'N' },
          { dir: 30, label: 'F' },
        ],
      },
      ctx
    );
    expect(parts.filter((part) => part.type === 'arrow')).toHaveLength(3);
    expect(texts(parts)).toEqual(expect.arrayContaining(['mg', 'N', 'F']));
    assertInBox(parts, box);
  });

  it('fbd labels sideways forces beyond the arrow tip', () => {
    const parts = compileDiagram(
      {
        type: 'diagram',
        kind: 'fbd',
        forces: [
          { dir: 'right', label: 'engine' },
          { dir: 'left', label: 'friction' },
        ],
      },
      ctx
    );
    const arrows = parts.filter((part) => part.type === 'arrow');
    const engine = parts.find((part) => part.text === 'engine');
    const friction = parts.find((part) => part.text === 'friction');
    expect(engine.align).toBe('left');
    expect(engine.x).toBeGreaterThan(arrows[0].to[0]);
    expect(friction.align).toBe('right');
    expect(friction.x).toBeLessThan(arrows[1].to[0]);
  });

  it('atom puts one electron per proton', () => {
    const parts = compileDiagram({ type: 'diagram', kind: 'atom', z: 11, symbol: 'Na' }, ctx);
    expect(parts.filter((part) => part.type === 'dot')).toHaveLength(11);
    expect(texts(parts)).toEqual(expect.arrayContaining(['Na', '2, 8, 1']));
    assertInBox(parts, box);
  });

  it('cell labels only the requested organelles', () => {
    const parts = compileDiagram(
      { type: 'diagram', kind: 'cell', cell: 'plant', labels: ['nucleus', 'chloroplast'] },
      ctx
    );
    expect(texts(parts).sort()).toEqual(['chloroplast', 'nucleus']);
    assertInBox(parts, box);
  });

  it('cell labels every drawn organelle when none are requested', () => {
    const parts = compileDiagram({ type: 'diagram', kind: 'cell', cell: 'animal' }, ctx);
    expect(texts(parts)).toEqual(expect.arrayContaining(['nucleus', 'cell membrane']));
    expect(texts(parts)).not.toContain('cell wall');
  });

  it.each([
    { kind: 'circuit', parts: ['battery', 'resistor', 'bulb', 'switch', 'ammeter', 'voltmeter'] },
    { kind: 'lens', shape: 'convex', f: 10, u: 30, h: 2 },
    { kind: 'lens', shape: 'convex', f: 10, u: 5, h: 2 },
    { kind: 'lens', shape: 'concave', f: 10, u: 30, h: 2 },
    { kind: 'mirror', shape: 'concave', f: 10, u: 30, h: 2 },
    { kind: 'mirror', shape: 'convex', f: 10, u: 30, h: 2 },
    { kind: 'fbd', body: 'ball', forces: [{ dir: 'left', label: 'friction', size: 2 }] },
    { kind: 'atom', z: 20 },
    { kind: 'cell', cell: 'plant' },
    { kind: 'apparatus', items: ['beaker', 'test_tube', 'flask', 'burner'] },
    { kind: 'apparatus', items: ['stand'], title: 'Set up' },
  ])('$kind fits its box', (action) => {
    assertInBox(compileDiagram({ type: 'diagram', ...action }, ctx), box);
  });

  it('a lens with the object at F still draws', () => {
    const parts = compileDiagram({ type: 'diagram', kind: 'lens', f: 10, u: 10 }, ctx);
    expect(parts.length).toBeGreaterThan(0);
    assertInBox(parts, box);
  });

  it('unknown kinds draw nothing', () => {
    expect(compileDiagram({ type: 'diagram', kind: 'spaceship' }, ctx)).toEqual([]);
  });
});
