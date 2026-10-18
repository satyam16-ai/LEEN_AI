import { BOARD_HEIGHT, BOARD_WIDTH } from './board';
import { partialPath } from './strokes';

/** Board units per second². Exaggerated from real life so a fall reads clearly on screen. */
export const GRAVITY = 1400;
const DEFAULT_GROUND = 820;
const MIN_BOUNCE_SPEED = 90;
const TAU = Math.PI * 2;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

const pose = (start, changes) => ({ ...start, ...changes });

/**
 * Turn an `animate` action into a motion: `{ duration, loop, at(t) }`.
 *  - `start` is the object's pose ({x, y, rotation, scale}) when the motion begins
 *  - `half` is half the object's height, so things land on the ground, not in it
 *  - `centreOf(id)` returns another object's current centre (orbit "around")
 * `at(t)` gives the pose `t` seconds in; `duration` is in seconds (Infinity for loops).
 * Returns null for a motion that can't run.
 */
export function createMotion(action, start, half = 0, centreOf = () => null) {
  const motion = buildMotion(action, start, half, centreOf);
  if (!motion) return null;
  const loop = Boolean(action.loop);
  if (!loop) return { ...motion, loop };
  if (Number.isFinite(motion.duration) && motion.duration > 0) {
    // Repeat a one-shot motion (e.g. drop the apple again and again).
    const once = motion.at;
    return { duration: Infinity, loop, at: (t) => once(t % motion.duration) };
  }
  return { ...motion, duration: Infinity, loop };
}

function buildMotion(action, start, half, centreOf) {
  switch (action.motion) {
    case 'fall':
      return fall(action, start, half);
    case 'projectile':
      return projectile(action, start, half);
    case 'orbit':
      return orbit(action, start, centreOf);
    case 'swing':
      return swing(action, start);
    case 'move': {
      const [toX, toY] = action.to ?? [start.x, start.y];
      const duration = action.duration ?? 1.5;
      return {
        duration,
        at: (t) => {
          const k = easeInOut(clamp(t / duration, 0, 1));
          return pose(start, {
            x: start.x + (toX - start.x) * k,
            y: start.y + (toY - start.y) * k,
          });
        },
      };
    }
    case 'path': {
      if (!action.points?.length) return null;
      const points = [[start.x, start.y], ...action.points];
      const duration = action.duration ?? 2;
      return {
        duration,
        at: (t) => {
          const [x, y] = partialPath(points, clamp(t / duration, 0, 1)).at(-1);
          return pose(start, { x, y });
        },
      };
    }
    case 'oscillate': {
      const dx = action.dx ?? (action.dy ? 0 : 80);
      const dy = action.dy ?? 0;
      const period = action.period ?? 1.2;
      return {
        duration: (action.cycles ?? 3) * period,
        at: (t) => {
          const s = Math.sin((TAU * t) / period);
          return pose(start, { x: start.x + dx * s, y: start.y + dy * s });
        },
      };
    }
    case 'spin': {
      const period = action.period ?? 2;
      const direction = action.clockwise ? 1 : -1;
      return {
        duration: (action.cycles ?? 1) * period,
        at: (t) =>
          pose(start, { rotation: (start.rotation ?? 0) + (direction * TAU * t) / period }),
      };
    }
    case 'pulse': {
      const period = action.period ?? 0.9;
      return {
        duration: (action.cycles ?? 3) * period,
        at: (t) => pose(start, { scale: 1 + 0.18 * Math.sin((TAU * t) / period) }),
      };
    }
    default:
      return null;
  }
}

/** Free fall with optional bounces: y = y0 + ½gt², then shrinking hops. */
function fall(action, start, half) {
  const ground = (action.to_y ?? DEFAULT_GROUND) - half;
  const height = Math.max(0, ground - start.y);
  const fallTime = Math.sqrt((2 * height) / GRAVITY);
  const restitution = action.bounce ?? 0;
  const hops = [];
  let speed = GRAVITY * fallTime * restitution;
  while (speed > MIN_BOUNCE_SPEED && hops.length < 8) {
    hops.push({ speed, time: (2 * speed) / GRAVITY });
    speed *= restitution;
  }
  const duration = fallTime + hops.reduce((total, hop) => total + hop.time, 0);
  return {
    duration,
    at: (t) => {
      if (t < fallTime) return pose(start, { y: start.y + 0.5 * GRAVITY * t * t });
      let rest = t - fallTime;
      for (const hop of hops) {
        if (rest < hop.time) {
          return pose(start, { y: ground - (hop.speed * rest - 0.5 * GRAVITY * rest * rest) });
        }
        rest -= hop.time;
      }
      return pose(start, { y: Math.max(start.y, ground) });
    },
  };
}

/** A thrown object: x = x0 + vx·t, y = y0 + vy·t + ½gt², until it lands. */
function projectile(action, start, half) {
  const ground = (action.ground_y ?? DEFAULT_GROUND) - half;
  const vx = action.vx ?? 320;
  const vy = action.vy ?? -650;
  // Solve ½g·t² + vy·t + (y0 - ground) = 0 for the landing time.
  const discriminant = vy * vy - 2 * GRAVITY * (start.y - ground);
  const duration = discriminant >= 0 ? Math.max(0.2, (-vy + Math.sqrt(discriminant)) / GRAVITY) : 2;
  return {
    duration,
    at: (t) =>
      pose(start, {
        x: clamp(start.x + vx * t, half, BOARD_WIDTH - half),
        y: Math.min(ground, start.y + vy * t + 0.5 * GRAVITY * t * t),
      }),
  };
}

function orbit(action, start, centreOf) {
  const fixed = { x: action.cx ?? start.x - 150, y: action.cy ?? start.y };
  const centre = () => (action.around && centreOf(action.around)) || fixed;
  const c0 = centre();
  const radius = action.r ?? Math.max(30, Math.hypot(start.x - c0.x, start.y - c0.y));
  const startAngle = Math.atan2(start.y - c0.y, start.x - c0.x);
  // On screen (y down) a growing angle turns clockwise; planets are shown anticlockwise.
  const direction = action.clockwise ? 1 : -1;
  const period = action.period ?? 4;
  return {
    duration: (action.cycles ?? 1) * period,
    at: (t) => {
      const { x, y } = centre();
      const angle = startAngle + (direction * TAU * t) / period;
      return pose(start, {
        x: clamp(x + radius * Math.cos(angle), 0, BOARD_WIDTH),
        y: clamp(y + radius * Math.sin(angle), 0, BOARD_HEIGHT),
      });
    },
  };
}

/** Pendulum: θ = A·cos(2πt/T); a one-off swing dies down to rest. */
function swing(action, start) {
  const pivot = action.pivot ?? start.pivot ?? [start.x, Math.max(0, start.y - 220)];
  const length = action.length ?? Math.max(40, Math.hypot(start.x - pivot[0], start.y - pivot[1]));
  const amplitude = ((action.angle ?? 30) * Math.PI) / 180;
  const period = action.period ?? 2;
  const duration = (action.cycles ?? 3) * period;
  return {
    duration,
    at: (t) => {
      const decay = action.loop ? 1 : Math.max(0, 1 - t / duration);
      const theta = amplitude * decay * Math.cos((TAU * t) / period);
      return pose(start, {
        x: pivot[0] + length * Math.sin(theta),
        y: pivot[1] + length * Math.cos(theta),
        pivot,
      });
    },
  };
}
