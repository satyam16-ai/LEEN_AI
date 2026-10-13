import { BOARD_THEMES, colorOf, handFont } from './board';
import { createMotion } from './motion';
import { drawSprite } from './sprites';
import { circleStroke, mulberry32, rectStrokes } from './strokes';

const FADE_MS = 350;
const LABEL_SIZE = 30;
const TRAIL_STEP = 6;
// About one lap of a typical orbit: older dots drop off instead of piling up into a solid line.
const TRAIL_MAX = 240;
const MAX_WAIT_SECONDS = 15;
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** How far an object's centre sits above the ground when it lands. */
function halfHeight(def) {
  if (def.shape === 'circle') return def.r ?? def.size / 2;
  if (def.shape === 'rect') return (def.h ?? def.size) / 2;
  if (def.shape === 'arrow') return 0;
  return def.size / 2;
}

const currentPose = (object) => object.pose ?? object.base;

function traceOutline(ctx, strokes) {
  ctx.beginPath();
  for (const points of strokes) {
    points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  }
}

/**
 * Draw a (non-arrow) object at `pose`. `scale` and `alpha` are extra, for the
 * pop-in while the pencil places it and the fade-out when it is removed.
 */
export function drawObject(ctx, object, pose, theme, { alpha = 1, scale = 1 } = {}) {
  const { def } = object;
  const ink = colorOf(theme, 'ink');
  const color = colorOf(theme, def.color);
  const zoom = (pose.scale ?? 1) * scale;
  let label = def.label;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.rotation ?? 0);
  ctx.scale(zoom, zoom);
  if (object.outline) {
    traceOutline(ctx, object.outline);
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha *= def.fill ? 0.9 : BOARD_THEMES[theme].fillAlpha * 1.5;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = def.color === 'ink' ? ink : color;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();
  } else if (def.shape === 'emoji') {
    ctx.font = `${def.size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji || '⭐', 0, 0);
  } else {
    const style = { outline: ink, tint: def.color === 'ink' ? undefined : color };
    if (!drawSprite(ctx, def.sprite, def.size, style)) {
      // Unknown picture: a labelled ball keeps the explanation readable.
      ctx.beginPath();
      ctx.arc(0, 0, def.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = def.color === 'ink' ? '#94a3b8' : color;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      label ??= def.sprite;
    }
  }
  ctx.restore();

  if (label) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = handFont(LABEL_SIZE);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.fillText(label, pose.x, pose.y + object.half * zoom + LABEL_SIZE + 2);
    ctx.restore();
  }
}

/**
 * Objects on the animation layer and their motions. Time is the board clock in
 * milliseconds, so pausing or changing speed affects animations too.
 */
export class Scene {
  constructor() {
    this.objects = new Map();
  }

  get isEmpty() {
    return this.objects.size === 0;
  }

  clear() {
    this.objects.clear();
  }

  /** Build an object from an `object` action; it joins the board with add(). */
  create(action, seed) {
    const def = { ...action, shape: action.shape ?? 'sprite', size: action.size ?? 70 };
    if (def.follow && !this.objects.has(def.follow)) {
      if (def.x == null || def.y == null) return null;
      def.follow = undefined;
    }
    const rng = mulberry32(seed);
    let outline = null;
    if (def.shape === 'circle') outline = [circleStroke(0, 0, def.r ?? def.size / 2, rng)];
    if (def.shape === 'rect') {
      const w = def.w ?? def.size;
      const h = def.h ?? def.size;
      outline = rectStrokes(-w / 2, -h / 2, w, h, rng);
    }
    const object = {
      id: def.id,
      def,
      half: halfHeight(def),
      outline,
      base: { x: def.x ?? 0, y: def.y ?? 0, rotation: 0, scale: 1, pivot: def.pivot },
      pose: null,
      motion: null,
      trail: null,
      removing: null,
    };
    object.pose = this.poseOf(object, 0);
    return object;
  }

  add(object) {
    this.objects.set(object.id, object);
  }

  /** Start a motion. Returns how many seconds the board should wait for it. */
  animate(action, clock) {
    const object = this.objects.get(action.id);
    if (!object || object.def.follow || object.def.shape === 'arrow') return 0;
    const current = this.poseOf(object, clock);
    // A hanging object keeps its string only while it swings (a fall "cuts" it).
    const start = { ...current, pivot: action.motion === 'swing' ? current.pivot : undefined };
    const motion = createMotion(action, start, object.half, (id) => {
      const other = this.objects.get(id);
      return other ? currentPose(other) : null;
    });
    if (!motion) return 0;
    object.base = start;
    object.motion = { ...motion, start: clock };
    object.trail = action.trail ? [[start.x, start.y]] : null;
    const wait = action.wait ?? !motion.loop;
    return wait && Number.isFinite(motion.duration)
      ? Math.min(motion.duration, MAX_WAIT_SECONDS)
      : 0;
  }

  /** Freeze an object where it is (its trail stays). */
  stop(id, clock) {
    const object = this.objects.get(id);
    if (!object?.motion) return;
    object.base = { ...this.poseOf(object, clock) };
    object.motion = null;
  }

  /** Fade an object out, along with arrows attached to it. */
  remove(id, clock) {
    for (const object of this.objects.values()) {
      const attached = object.def.follow === id || object.def.toward === id;
      if ((object.id === id || attached) && object.removing === null) object.removing = clock;
    }
  }

  removeAll(clock) {
    for (const object of this.objects.values()) object.removing ??= clock;
  }

  poseOf(object, clock) {
    const { def } = object;
    if (def.follow) {
      const target = this.objects.get(def.follow);
      if (!target) return currentPose(object);
      const { x, y } = currentPose(target);
      if (def.shape === 'arrow') return { x, y, rotation: 0, scale: 1 };
      return { ...object.base, x: x + (def.dx ?? 0), y: y + (def.dy ?? 0) };
    }
    if (!object.motion) return object.base;
    const { duration, at, start } = object.motion;
    const t = Math.max(0, (clock - start) / 1000);
    return at(Number.isFinite(duration) ? Math.min(t, duration) : t);
  }

  _moving(object, clock) {
    if (!object.motion) return false;
    return object.motion.loop || (clock - object.motion.start) / 1000 < object.motion.duration;
  }

  /** True while anything is still moving or fading. */
  isAnimating(clock) {
    for (const object of this.objects.values()) {
      if (object.removing !== null || this._moving(object, clock)) return true;
    }
    return false;
  }

  update(clock) {
    for (const [id, object] of this.objects) {
      if (object.removing !== null && clock - object.removing >= FADE_MS) this.objects.delete(id);
    }
    // Leaders first, so attached objects use this frame's position.
    const ordered = [...this.objects.values()].sort(
      (a, b) => Number(Boolean(a.def.follow)) - Number(Boolean(b.def.follow))
    );
    for (const object of ordered) {
      object.pose = this.poseOf(object, clock);
      if (object.trail && this._moving(object, clock)) {
        const last = object.trail.at(-1);
        const { x, y } = object.pose;
        if (!last || Math.hypot(last[0] - x, last[1] - y) >= TRAIL_STEP) {
          object.trail.push([x, y]);
          if (object.trail.length > TRAIL_MAX) object.trail.shift();
        }
      }
    }
  }

  alphaOf(object, clock) {
    return object.removing === null ? 1 : Math.max(0, 1 - (clock - object.removing) / FADE_MS);
  }

  draw(ctx, theme, clock) {
    const ink = colorOf(theme, 'ink');
    const objects = [...this.objects.values()];

    for (const object of objects) {
      const alpha = this.alphaOf(object, clock);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (object.trail?.length > 1) {
        ctx.beginPath();
        object.trail.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.setLineDash([2, 12]);
        ctx.lineCap = 'round';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha * 0.6;
        ctx.strokeStyle = colorOf(theme, object.def.color === 'ink' ? 'blue' : object.def.color);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = alpha;
      }
      const pivot = object.pose?.pivot;
      if (pivot) {
        ctx.beginPath();
        ctx.moveTo(pivot[0] - 40, pivot[1]);
        ctx.lineTo(pivot[0] + 40, pivot[1]);
        ctx.moveTo(pivot[0], pivot[1]);
        ctx.lineTo(object.pose.x, object.pose.y);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pivot[0], pivot[1], 6, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
      }
      ctx.restore();
    }

    for (const object of objects) {
      if (object.def.shape === 'arrow') continue;
      drawObject(ctx, object, object.pose ?? object.base, theme, {
        alpha: this.alphaOf(object, clock),
      });
    }
    for (const object of objects) {
      if (object.def.shape === 'arrow')
        this.drawArrow(ctx, object, theme, this.alphaOf(object, clock));
    }
  }

  /** Start/end of an arrow, which may hang off a moving object or point at one. */
  arrowGeometry(object) {
    const { def } = object;
    const anchor = def.follow ? this.objects.get(def.follow) : null;
    const origin = anchor ? currentPose(anchor) : { x: def.x, y: def.y };
    if (origin.x == null || origin.y == null) return null;

    let direction;
    let length;
    const target = def.toward ? this.objects.get(def.toward) : null;
    if (target) {
      const { x, y } = currentPose(target);
      const distance = Math.hypot(x - origin.x, y - origin.y) || 1;
      direction = [(x - origin.x) / distance, (y - origin.y) / distance];
      length = def.length ?? 70;
    } else {
      const dx = def.dx ?? 0;
      const dy = def.dy ?? (def.dx ? 0 : 80);
      length = Math.hypot(dx, dy) || 1;
      direction = [dx / length, dy / length];
    }
    const gap = anchor ? anchor.half + 6 : 0;
    const start = [origin.x + direction[0] * gap, origin.y + direction[1] * gap];
    const end = [start[0] + direction[0] * length, start[1] + direction[1] * length];
    return { start, end, direction };
  }

  drawArrow(ctx, object, theme, alpha = 1) {
    const geometry = this.arrowGeometry(object);
    if (!geometry) return;
    const { start, end, direction } = geometry;
    const color = colorOf(theme, object.def.color === 'ink' ? 'red' : object.def.color);
    const angle = Math.atan2(direction[1], direction[0]);
    const head = 20;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0] - direction[0] * head * 0.6, end[1] - direction[1] * head * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end[0], end[1]);
    ctx.lineTo(end[0] - Math.cos(angle - 0.45) * head, end[1] - Math.sin(angle - 0.45) * head);
    ctx.lineTo(end[0] - Math.cos(angle + 0.45) * head, end[1] - Math.sin(angle + 0.45) * head);
    ctx.closePath();
    ctx.fill();
    if (object.def.label) {
      ctx.font = handFont(LABEL_SIZE * 0.9);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(object.def.label, end[0] + direction[0] * 34, end[1] + direction[1] * 26);
    }
    ctx.restore();
  }
}
