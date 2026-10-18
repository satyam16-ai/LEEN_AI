import { createMotion, GRAVITY } from './motion';

const start = (x, y) => ({ x, y, rotation: 0, scale: 1 });

describe('fall', () => {
  it('accelerates with gravity and lands on the ground line', () => {
    const motion = createMotion({ motion: 'fall', to_y: 800 }, start(1000, 200), 30);
    const ground = 770; // to_y minus half the object's height

    expect(motion.duration).toBeCloseTo(Math.sqrt((2 * (ground - 200)) / GRAVITY), 5);
    expect(motion.at(0).y).toBe(200);
    expect(motion.at(motion.duration).y).toBeCloseTo(ground, 5);
    // Falls further in the second half of the time than in the first (it speeds up).
    const half = motion.duration / 2;
    const firstHalf = motion.at(half).y - 200;
    expect(ground - motion.at(half).y).toBeGreaterThan(firstHalf * 2.5);
    expect(motion.at(0.3).x).toBe(1000);
  });

  it('bounces lower each time before settling', () => {
    const plain = createMotion({ motion: 'fall', to_y: 800 }, start(0, 200), 0);
    const bouncy = createMotion({ motion: 'fall', to_y: 800, bounce: 0.5 }, start(0, 200), 0);

    expect(bouncy.duration).toBeGreaterThan(plain.duration);
    const afterLanding = plain.duration + 0.1;
    expect(bouncy.at(afterLanding).y).toBeLessThan(800);
    expect(bouncy.at(bouncy.duration).y).toBeCloseTo(800, 5);
  });

  it('repeats when looped', () => {
    const motion = createMotion({ motion: 'fall', to_y: 800, loop: true }, start(0, 200), 0);
    expect(motion.duration).toBe(Infinity);
    expect(motion.at(0.05).y).toBeCloseTo(motion.at(0.05 + 0.9258201).y, 1);
  });
});

describe('projectile', () => {
  it('flies in a parabola and lands', () => {
    const motion = createMotion(
      { motion: 'projectile', vx: 300, vy: -700, ground_y: 800 },
      start(200, 800),
      0
    );

    expect(motion.duration).toBeCloseTo((2 * 700) / GRAVITY, 5);
    const peak = motion.at(700 / GRAVITY);
    expect(peak.y).toBeCloseTo(800 - (700 * 700) / (2 * GRAVITY), 5);
    expect(motion.at(motion.duration)).toMatchObject({ x: 200 + 300 * motion.duration, y: 800 });
  });
});

describe('orbit', () => {
  it('keeps its distance from a moving centre and comes back after one period', () => {
    let centre = { x: 800, y: 450 };
    const motion = createMotion(
      { motion: 'orbit', around: 'earth', period: 4, loop: true },
      start(1000, 450),
      0,
      () => centre
    );

    for (const t of [0, 0.7, 1.9, 3.3]) {
      const { x, y } = motion.at(t);
      expect(Math.hypot(x - 800, y - 450)).toBeCloseTo(200, 5);
    }
    expect(motion.at(4).x).toBeCloseTo(1000, 5);
    // Anticlockwise on screen: a quarter turn later it is above the centre.
    expect(motion.at(1).y).toBeCloseTo(250, 5);

    centre = { x: 900, y: 450 };
    expect(motion.at(0).x).toBeCloseTo(1100, 5);
  });
});

describe('swing', () => {
  it('hangs from the pivot at a fixed length, starting at the full angle', () => {
    const motion = createMotion(
      { motion: 'swing', pivot: [800, 100], angle: 30, period: 2, loop: true },
      start(800, 400),
      0
    );

    for (const t of [0, 0.3, 1.1]) {
      const { x, y, pivot } = motion.at(t);
      expect(Math.hypot(x - 800, y - 100)).toBeCloseTo(300, 5);
      expect(pivot).toEqual([800, 100]);
    }
    expect(motion.at(0).x).toBeCloseTo(800 + 300 * Math.sin(Math.PI / 6), 5);
    expect(motion.at(1).x).toBeCloseTo(800 - 300 * Math.sin(Math.PI / 6), 5);
  });
});

describe('move, oscillate, spin and pulse', () => {
  it('glide, wobble, turn and throb as described', () => {
    const move = createMotion({ motion: 'move', to: [500, 300], duration: 2 }, start(100, 100));
    expect(move.at(2)).toMatchObject({ x: 500, y: 300 });
    expect(move.at(1).x).toBeCloseTo(300, 5);

    const wobble = createMotion({ motion: 'oscillate', dx: 50, period: 1 }, start(100, 100));
    expect(wobble.at(0.25).x).toBeCloseTo(150, 5);
    expect(wobble.duration).toBe(3);

    const spin = createMotion({ motion: 'spin', period: 2 }, start(0, 0));
    expect(spin.at(1).rotation).toBeCloseTo(-Math.PI, 5);

    const pulse = createMotion({ motion: 'pulse', period: 1 }, start(0, 0));
    expect(pulse.at(0.25).scale).toBeCloseTo(1.18, 5);
  });

  it('rejects motions it cannot run', () => {
    expect(createMotion({ motion: 'teleport' }, start(0, 0))).toBeNull();
    expect(createMotion({ motion: 'path' }, start(0, 0))).toBeNull();
  });
});
