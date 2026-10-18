import { Scene } from './scene';

function setup() {
  const scene = new Scene();
  const place = (action, seed = 1) => {
    const object = scene.create(action, seed);
    scene.add(object);
    return object;
  };
  return { scene, place };
}

describe('Scene', () => {
  it('moves an object over board time and keeps attached arrows on it', () => {
    const { scene, place } = setup();
    const apple = place({ id: 'apple', sprite: 'apple', x: 1100, y: 200, size: 60 });
    place({ id: 'g', shape: 'arrow', follow: 'apple', dx: 0, dy: 90 });

    const wait = scene.animate({ id: 'apple', motion: 'fall', to_y: 800 }, 1000);
    expect(wait).toBeCloseTo(Math.sqrt((2 * 570) / 1400), 5);
    expect(scene.isAnimating(1100)).toBe(true);

    scene.update(1000 + wait * 1000);
    expect(apple.pose.y).toBeCloseTo(770, 5);
    const arrow = scene.arrowGeometry(scene.objects.get('g'));
    // Starts just below the apple and points down 90 units.
    expect(arrow.start).toEqual([1100, 770 + 30 + 6]);
    expect(arrow.end[1] - arrow.start[1]).toBeCloseTo(90, 5);
    expect(scene.isAnimating(1000 + wait * 1000 + 1)).toBe(false);
  });

  it('points "toward" arrows at another object as it moves', () => {
    const { scene, place } = setup();
    place({ id: 'earth', sprite: 'earth', x: 800, y: 450, size: 150 });
    place({ id: 'moon', sprite: 'moon', x: 1100, y: 450, size: 50 });
    place({ id: 'pull', shape: 'arrow', follow: 'moon', toward: 'earth', length: 70 });

    expect(
      scene.animate({ id: 'moon', motion: 'orbit', around: 'earth', period: 4, loop: true }, 0)
    ).toBe(0);
    scene.update(1000); // a quarter turn: the Moon is above the Earth

    const { start, end } = scene.arrowGeometry(scene.objects.get('pull'));
    expect(start[0]).toBeCloseTo(800, 5);
    expect(end[1] - start[1]).toBeCloseTo(70, 5);
    expect(scene.isAnimating(999_999)).toBe(true);
  });

  it('fades removed objects (and their arrows) out, then forgets them', () => {
    const { scene, place } = setup();
    place({ id: 'ball', sprite: 'ball', x: 100, y: 100 });
    place({ id: 'v', shape: 'arrow', follow: 'ball', dx: 80, dy: 0 });

    scene.remove('ball', 0);
    expect(scene.isAnimating(100)).toBe(true);
    scene.update(1000);
    expect(scene.isEmpty).toBe(true);
  });

  it('stop freezes an object where it is', () => {
    const { scene, place } = setup();
    const car = place({ id: 'car', sprite: 'car', x: 100, y: 500 });
    scene.animate({ id: 'car', motion: 'move', to: [900, 500], duration: 2 }, 0);

    scene.stop('car', 1000);
    scene.update(5000);

    expect(car.pose.x).toBeCloseTo(500, 5);
    expect(scene.isAnimating(5000)).toBe(false);
  });

  it('ignores actions for missing objects', () => {
    const { scene } = setup();
    expect(scene.create({ id: 'a', shape: 'arrow', follow: 'nothing' }, 1)).toBeNull();
    expect(scene.animate({ id: 'ghost', motion: 'fall' }, 0)).toBe(0);
    expect(() => scene.stop('ghost', 0)).not.toThrow();
  });

  it('hangs an object from its pivot and swings from there', () => {
    const { scene, place } = setup();
    const bob = place({ id: 'bob', sprite: 'ball', x: 800, y: 400, size: 40, pivot: [800, 100] });
    expect(bob.pose.pivot).toEqual([800, 100]);

    scene.animate({ id: 'bob', motion: 'swing', angle: 30, period: 2, loop: true }, 0);
    scene.update(500); // a quarter period: straight down
    expect(bob.pose.pivot).toEqual([800, 100]);
    expect(bob.pose.y).toBeCloseTo(400, 5);

    scene.animate({ id: 'bob', motion: 'fall', to_y: 800 }, 600); // cut the string
    scene.update(700);
    expect(bob.pose.pivot).toBeUndefined();
  });
});
