/**
 * Built-in pictures for animations, drawn as vectors so they look the same on
 * every device (no emoji font needed). Each draws centred on (0, 0) and fits a
 * `size`-wide box. `outline` is the board's ink colour, `tint` an optional
 * palette colour for sprites that take one (ball, block, car).
 */

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function shine(ctx, r) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function finish(ctx, fill, outline, width = 2.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

const SPRITES = {
  apple(ctx, s, { outline }) {
    const r = s / 2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.bezierCurveTo(r * 0.9, -r * 1.05, r * 1.25, r * 0.2, r * 0.45, r * 0.85);
    ctx.bezierCurveTo(r * 0.2, r * 1.0, -r * 0.2, r * 1.0, -r * 0.45, r * 0.85);
    ctx.bezierCurveTo(-r * 1.25, r * 0.2, -r * 0.9, -r * 1.05, 0, -r * 0.55);
    finish(ctx, '#e53935', outline);
    shine(ctx, r);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.05, -r * 0.9, r * 0.12, -r * 1.0);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#6d4c41';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(r * 0.38, -r * 0.82, r * 0.28, r * 0.12, -0.5, 0, Math.PI * 2);
    finish(ctx, '#43a047', outline, 1.5);
  },

  ball(ctx, s, { outline, tint }) {
    const r = s / 2;
    circle(ctx, 0, 0, r);
    finish(ctx, tint ?? '#fb8c00', outline);
    ctx.beginPath();
    ctx.arc(-r * 1.6, 0, r * 1.25, -0.6, 0.6);
    ctx.arc(r * 1.6, 0, r * 1.25, Math.PI - 0.6, Math.PI + 0.6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    shine(ctx, r);
  },

  stone(ctx, s, { outline }) {
    const r = s / 2;
    ctx.beginPath();
    const corners = [
      [-0.95, 0.1],
      [-0.7, -0.6],
      [-0.1, -0.85],
      [0.6, -0.65],
      [0.95, 0.05],
      [0.7, 0.7],
      [-0.05, 0.85],
      [-0.75, 0.6],
    ];
    corners.forEach(([x, y], index) =>
      index ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)
    );
    ctx.closePath();
    finish(ctx, '#8d8d8d', outline);
    shine(ctx, r);
  },

  earth(ctx, s, { outline }) {
    const r = s / 2;
    circle(ctx, 0, 0, r);
    finish(ctx, '#2f80ed', outline);
    ctx.save();
    circle(ctx, 0, 0, r - 1);
    ctx.clip();
    ctx.fillStyle = '#43a047';
    const lands = [
      [-0.35, -0.35, 0.42, 0.28, 0.4],
      [-0.15, 0.25, 0.22, 0.45, -0.3],
      [0.45, -0.05, 0.3, 0.5, 0.2],
      [0.15, -0.75, 0.35, 0.12, 0],
    ];
    for (const [x, y, w, h, angle] of lands) {
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, w * r, h * r, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    shine(ctx, r);
  },

  moon(ctx, s, { outline }) {
    const r = s / 2;
    circle(ctx, 0, 0, r);
    finish(ctx, '#cfd2d6', outline);
    ctx.fillStyle = '#a7abb1';
    for (const [x, y, size] of [
      [-0.3, -0.25, 0.22],
      [0.35, 0.1, 0.16],
      [-0.05, 0.45, 0.13],
    ]) {
      circle(ctx, x * r, y * r, size * r);
      ctx.fill();
    }
  },

  sun(ctx, s, { outline }) {
    const r = s * 0.34;
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(3, s * 0.05);
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r * 1.2, Math.sin(angle) * r * 1.2);
      ctx.lineTo(Math.cos(angle) * s * 0.5, Math.sin(angle) * s * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    circle(ctx, 0, 0, r);
    finish(ctx, '#fcd34d', outline);
  },

  planet(ctx, s, { outline }) {
    const r = s * 0.32;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.5, s * 0.14, -0.35, Math.PI, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c08457';
    ctx.stroke();
    circle(ctx, 0, 0, r);
    finish(ctx, '#e0b57a', outline);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.5, s * 0.14, -0.35, 0, Math.PI);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c08457';
    ctx.stroke();
  },

  star(ctx, s, { outline }) {
    const outer = s / 2;
    const inner = outer * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 ? inner : outer;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const point = [Math.cos(angle) * radius, Math.sin(angle) * radius];
      if (i) ctx.lineTo(...point);
      else ctx.moveTo(...point);
    }
    ctx.closePath();
    finish(ctx, '#fbbf24', outline);
  },

  rocket(ctx, s, { outline }) {
    const h = s / 2;
    const w = s * 0.2;
    // Flame
    ctx.beginPath();
    ctx.moveTo(-w * 0.6, h * 0.55);
    ctx.quadraticCurveTo(0, h * 1.25, w * 0.6, h * 0.55);
    ctx.fillStyle = '#fb923c';
    ctx.fill();
    // Fins
    ctx.beginPath();
    ctx.moveTo(-w, h * 0.15);
    ctx.lineTo(-w * 2, h * 0.65);
    ctx.lineTo(-w, h * 0.55);
    ctx.moveTo(w, h * 0.15);
    ctx.lineTo(w * 2, h * 0.65);
    ctx.lineTo(w, h * 0.55);
    finish(ctx, '#ef4444', outline, 2);
    // Body and nose
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.quadraticCurveTo(w * 1.5, -h * 0.4, w, h * 0.6);
    ctx.lineTo(-w, h * 0.6);
    ctx.quadraticCurveTo(-w * 1.5, -h * 0.4, 0, -h);
    finish(ctx, '#f1f5f9', outline);
    circle(ctx, 0, -h * 0.2, w * 0.55);
    finish(ctx, '#60a5fa', outline, 2);
  },

  car(ctx, s, { outline, tint }) {
    const w = s / 2;
    const h = s * 0.22;
    ctx.beginPath();
    ctx.roundRect(-w * 0.55, -h * 1.7, w * 1.05, h * 1.1, 8);
    finish(ctx, '#bfdbfe', outline, 2);
    ctx.beginPath();
    ctx.roundRect(-w, -h * 0.7, w * 2, h * 1.3, 10);
    finish(ctx, tint ?? '#ef4444', outline);
    for (const x of [-w * 0.55, w * 0.55]) {
      circle(ctx, x, h * 0.6, h * 0.55);
      finish(ctx, '#27272a', outline, 2);
      circle(ctx, x, h * 0.6, h * 0.2);
      ctx.fillStyle = '#d4d4d8';
      ctx.fill();
    }
  },

  block(ctx, s, { outline, tint }) {
    const half = s / 2;
    ctx.beginPath();
    ctx.rect(-half, -half * 0.8, s, s * 0.8);
    finish(ctx, tint ?? '#d97706', outline);
    ctx.beginPath();
    ctx.moveTo(-half, -half * 0.8);
    ctx.lineTo(-half * 0.7, -half);
    ctx.lineTo(half * 1.3, -half);
    ctx.lineTo(half, -half * 0.8);
    finish(ctx, 'rgba(255,255,255,0.35)', outline, 2);
  },

  drop(ctx, s, { outline }) {
    const r = s * 0.36;
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.bezierCurveTo(r * 0.6, -r * 0.6, r * 1.15, r * 0.1, r, r * 0.55);
    ctx.arc(0, r * 0.55, r, 0, Math.PI);
    ctx.bezierCurveTo(-r * 1.15, r * 0.1, -r * 0.6, -r * 0.6, 0, -s / 2);
    finish(ctx, '#38bdf8', outline);
    shine(ctx, r);
  },

  cloud(ctx, s, { outline }) {
    const r = s * 0.2;
    ctx.beginPath();
    ctx.arc(-r * 1.3, r * 0.3, r, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(-r * 0.4, -r * 0.5, r * 1.1, Math.PI, Math.PI * 1.9);
    ctx.arc(r * 0.9, -r * 0.1, r * 1.2, Math.PI * 1.3, Math.PI * 0.4);
    ctx.lineTo(-r * 1.3, r * 1.3);
    ctx.closePath();
    finish(ctx, '#f8fafc', outline);
  },

  feather(ctx, s, { outline }) {
    const h = s / 2;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.bezierCurveTo(-h * 0.6, h * 0.2, -h * 0.35, -h * 0.6, h * 0.1, -h);
    ctx.bezierCurveTo(h * 0.45, -h * 0.4, h * 0.4, h * 0.3, 0, h);
    finish(ctx, '#ede9fe', outline, 2);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.quadraticCurveTo(0, 0, h * 0.1, -h);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  },
};

export const SPRITE_NAMES = Object.keys(SPRITES);

/** Draw sprite `name`; returns false if there is no such sprite. */
export function drawSprite(ctx, name, size, style) {
  const draw = SPRITES[name];
  if (!draw) return false;
  ctx.save();
  ctx.lineJoin = 'round';
  draw(ctx, size, style);
  ctx.restore();
  return true;
}
