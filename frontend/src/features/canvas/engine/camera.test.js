import { cameraTransform } from './camera';

describe('cameraTransform', () => {
  it('zooms so the focus box fills the board', () => {
    expect(cameraTransform([400, 225, 800, 450])).toEqual({ scale: 2, tx: 0, ty: 0 });
  });

  it('moves the focus box to the centre', () => {
    const { scale, tx, ty } = cameraTransform([0, 0, 800, 450]);
    expect(scale).toBe(2);
    expect(tx).toBeCloseTo(50);
    expect(ty).toBeCloseTo(50);
  });

  it('never zooms in more than 2.5 times', () => {
    expect(cameraTransform([700, 400, 100, 50]).scale).toBe(2.5);
  });

  it('is the identity with no focus', () => {
    expect(cameraTransform(null)).toEqual({ scale: 1, tx: 0, ty: 0 });
    expect(cameraTransform([1, 2])).toEqual({ scale: 1, tx: 0, ty: 0 });
  });
});
