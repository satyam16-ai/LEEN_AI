import { fitText } from './text';
import { measure } from './testUtils';

describe('fitText', () => {
  it('keeps text that fits', () => {
    expect(fitText('Na', 20, 100, measure)).toBe('Na');
  });

  it('shortens text with an ellipsis to fit', () => {
    const fitted = fitText('Chlorophyll absorbs light', 20, 100, measure);
    expect(fitted.endsWith('…')).toBe(true);
    expect(measure(fitted, 20)).toBeLessThanOrEqual(100);
  });

  it('gives up with an empty string when nothing fits', () => {
    expect(fitText('abc', 20, 5, measure)).toBe('');
  });
});
