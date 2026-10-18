import { STAGE } from '../board';
import { placeVisual, writeRoom } from './layout';

describe('placeVisual', () => {
  it('uses an explicit box as given', () => {
    const state = { stageY: STAGE.y };
    expect(placeVisual({ type: 'plot', at: [100, 120, 500, 300] }, state)).toEqual({
      x: 100,
      y: 120,
      w: 500,
      h: 300,
    });
    expect(state.stageY).toBe(STAGE.y);
  });

  it('stacks visuals down the stage and wraps to the top when it is full', () => {
    const state = { stageY: STAGE.y };
    const first = placeVisual({ type: 'plot' }, state);
    const second = placeVisual({ type: 'plot' }, state);
    const third = placeVisual({ type: 'plot' }, state);

    expect(first).toEqual({ x: 920, y: 100, w: 620, h: 360 });
    expect(second.y).toBe(490);
    expect(third.y).toBe(100);
  });

  it('gives each visual type its own default height', () => {
    const state = { stageY: STAGE.y };
    expect(placeVisual({ type: 'numberline' }, state).h).toBe(140);
    expect(placeVisual({ type: 'unknown' }, state).h).toBe(380);
  });
});

describe('writeRoom', () => {
  it('keeps column writes clear of the stage', () => {
    expect(writeRoom(80, 'left')).toBe(820);
    expect(writeRoom(300, 'left')).toBe(600);
  });

  it('lets full-width and stage writes run to the board edge', () => {
    expect(writeRoom(80, 'full')).toBe(1496);
    expect(writeRoom(940, 'right')).toBe(636);
  });
});
