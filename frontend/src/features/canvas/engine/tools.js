/** Vector drawings of the pencil and the duster, in board units. */

const PENCIL_ANGLE = -0.9; // the body points up and to the right, like a right hand holds it

function pencilShape(ctx) {
  // Graphite tip and sharpened wood
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(40, -11);
  ctx.lineTo(40, 11);
  ctx.closePath();
}

export function drawPencil(ctx, x, y, { lifted = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y - lifted);
  ctx.rotate(PENCIL_ANGLE);

  // Soft shadow on the board
  ctx.save();
  ctx.translate(10 + lifted * 0.6, 14 + lifted * 0.6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
  pencilShape(ctx);
  ctx.fill();
  ctx.fillRect(40, -11, 150, 22);
  ctx.restore();

  // Wood cone, then the graphite point over it
  pencilShape(ctx);
  ctx.fillStyle = '#f2cf9f';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(14, -4);
  ctx.lineTo(14, 4);
  ctx.closePath();
  ctx.fillStyle = '#3f3f46';
  ctx.fill();

  // Hexagonal body: three faces in different shades of yellow
  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(40, -11, 120, 7);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(40, -4, 120, 8);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(40, 4, 120, 7);

  // Metal ferrule and eraser end
  ctx.fillStyle = '#a1a1aa';
  ctx.fillRect(160, -11, 16, 22);
  ctx.fillStyle = '#d4d4d8';
  ctx.fillRect(164, -11, 3, 22);
  ctx.fillRect(170, -11, 3, 22);
  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath();
  ctx.roundRect(176, -11, 18, 22, [0, 6, 6, 0]);
  ctx.fill();
  ctx.restore();
}

/** A classroom duster centred on (x, y): wooden back, grey felt underneath. */
export function drawDuster(ctx, x, y, scale = 1) {
  const w = 120 * scale;
  const h = 62 * scale;
  ctx.save();
  ctx.translate(x - w / 2, y - h / 2);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.beginPath();
  ctx.roundRect(8 * scale, 10 * scale, w, h, 12 * scale);
  ctx.fill();

  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.roundRect(0, h * 0.62, w, h * 0.38, [0, 0, 10 * scale, 10 * scale]);
  ctx.fill();

  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h * 0.66, [12 * scale, 12 * scale, 4 * scale, 4 * scale]);
  ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.roundRect(w * 0.2, h * 0.2, w * 0.6, h * 0.16, 4 * scale);
  ctx.fill();
  ctx.restore();
}
