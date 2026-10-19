import { stepEnd } from './steps';

const c = { type: 'caption', text: 'c' };
const w = { type: 'write', text: 'w' };

describe('stepEnd', () => {
  it('finds the next caption that has not started', () => {
    expect(stepEnd([c, w, w, c, w], 1)).toBe(3);
    expect(stepEnd([c, w, w, c, w], 3)).toBe(3);
  });

  it('is the end of the list when no caption is left', () => {
    expect(stepEnd([c, w], 1)).toBe(2);
  });
});
