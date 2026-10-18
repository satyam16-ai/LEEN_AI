import {
  BOARD_HEIGHT,
  BOARD_THEMES,
  BOARD_WIDTH,
  colorOf,
  COLUMNS,
  FONT_SIZES,
  handFont,
  LABEL_PX,
  LINE_SPACING,
  MARGIN,
  STAGE,
} from './board';
import { expandAction, isCompiled, needsMath } from './compile';
import { placeVisual } from './compile/layout';
import { isMathReady, loadMath } from './math/expr';
import { layoutMathText } from './mathText';
import { drawObject, Scene } from './scene';
import {
  arrowStrokes,
  circleStroke,
  eraserPath,
  mulberry32,
  partialPath,
  pathLength,
  rectStrokes,
  wobblyLine,
} from './strokes';
import { drawDuster, drawPencil } from './tools';

const PEN_SPEED = 1100; // board units per second
const ERASER_SPEED = 2000;
const CLEAR_SPEED = 7000;
const PEN_LIFT_MS = 120;
const FILL_MS = 350;
const STROKE_WIDTH = 4;
const CAPTION_MIN_MS = 1600;
const CAPTION_MS_PER_CHAR = 45;
// Never let a stuck narration hold the board for longer than this (board time).
const SPEECH_TIMEOUT_MS = 30000;
const EDGE = 24;
const FONT_WEIGHT = 400;
const POP_MS = 420;
const LABEL_SPEED = 0.6; // labels inside visuals are written faster than the main writing
const DASH = [14, 10];

const clamp01 = (value) => Math.min(1, Math.max(0, value));
// Overshoots a little, so placed pictures "pop" onto the board.
const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

function glyphDuration(glyph) {
  if (!glyph.char.trim()) return 40;
  return 55 + 100 * (glyph.width / glyph.size);
}

function tracePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
}

function strokePath(ctx, points, color, style) {
  if (points.length < 2) return;
  tracePath(ctx, points);
  ctx.strokeStyle = color;
  ctx.lineWidth = style?.width ?? STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (style?.dash) ctx.setLineDash(DASH);
  ctx.stroke();
  if (style?.dash) ctx.setLineDash([]);
}

/** Where the pencil hovers while a fill (rectangle, polygon or disc) is being shaded. */
function fillCenter(fill) {
  if (fill.points) {
    const sum = fill.points.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
    return [sum[0] / fill.points.length, sum[1] / fill.points.length];
  }
  if (fill.r !== undefined) return [fill.cx, fill.cy];
  return [fill.x + fill.w * 0.5, fill.y + fill.h * 0.5];
}

function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve();
  const fonts = Promise.all([document.fonts.load(handFont(46, FONT_WEIGHT))]);
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  return Promise.race([fonts, timeout]).catch(() => {});
}

/**
 * Plays a stream of board actions on three stacked canvases:
 *  - ink: everything that has been committed (written, drawn, erased)
 *  - scene: animated objects (sprites, shapes, force arrows), redrawn every frame
 *  - overlay: the glyph or stroke being drawn right now, plus the pencil/duster
 *
 * Actions can be enqueued while they stream in. Everything is laid out in
 * board units (1600x900) and scaled to the canvas size, so resizing or a theme
 * change simply redraws the committed actions.
 *
 * With a narrator attached (setNarrator) and narration on, each caption is read
 * aloud and the next caption waits until it has been spoken.
 *
 * React reads state through subscribe()/getSnapshot() (useSyncExternalStore).
 */
export class BoardPlayer {
  constructor() {
    this.listeners = new Set();
    this.theme = 'light';
    this.speed = 1;
    this.narrate = false;
    this.instant = false;
    this.paused = false;
    this.streaming = false;
    this.started = false;
    this.fontsReady = false;
    this.actions = [];
    this.ink = null;
    this.sceneCtx = null;
    this.overlay = null;
    this.scene = new Scene();
    this.raf = null;
    this.lastFrame = null;
    this.narrator = null;
    this.speaking = false;
    this.speechToken = 0;
    this._resetPlayback();
    this.snapshot = this._buildSnapshot();
  }

  setNarrator(narrator) {
    this.narrator = narrator;
    narrator.setRate(this.speed);
  }

  // -- wiring ----------------------------------------------------------------

  attach(inkCanvas, sceneCanvas, overlayCanvas) {
    this.inkCanvas = inkCanvas;
    this.sceneCanvas = sceneCanvas;
    this.overlayCanvas = overlayCanvas;
    this.ink = inkCanvas.getContext('2d');
    this.sceneCtx = sceneCanvas.getContext('2d');
    this.overlay = overlayCanvas.getContext('2d');
    if (!this.ink || !this.sceneCtx || !this.overlay) return;
    loadFonts().then(() => {
      this.fontsReady = true;
      this._wake();
    });
  }

  detach() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.lastFrame = null;
    this.ink = null;
    this.sceneCtx = null;
    this.overlay = null;
    this._stopSpeech();
  }

  resize(cssWidth) {
    if (!this.ink || cssWidth <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(((cssWidth * BOARD_HEIGHT) / BOARD_WIDTH) * dpr);
    if (this.inkCanvas.width === width && this.inkCanvas.height === height) return;
    for (const canvas of [this.inkCanvas, this.sceneCanvas, this.overlayCanvas]) {
      canvas.width = width;
      canvas.height = height;
    }
    this.pixelScale = width / BOARD_WIDTH;
    this._redraw();
    this._drawScene();
    this._drawOverlay(performance.now());
    this._wake();
  }

  setTheme(theme) {
    if (theme === this.theme) return;
    this.theme = theme;
    this._redraw();
    this._drawScene();
    this._drawOverlay(performance.now());
  }

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  // -- playback control ------------------------------------------------------

  /** Start a fresh board for a live stream; follow with enqueue() and endStream(). */
  begin() {
    this.load([], { streaming: true });
  }

  enqueue(action) {
    this.actions.push(action);
    if (this.narrate && action?.type === 'caption') this.narrator?.prefetch(action.text);
    this._wake();
  }

  endStream() {
    this.streaming = false;
    this._emit();
    this._wake();
  }

  /** Replace the board with a saved explanation and play it from the start. */
  load(actions, { streaming = false } = {}) {
    this.actions = [...actions];
    this.streaming = streaming;
    this.started = streaming || actions.length > 0;
    this._restart();
  }

  replay() {
    this._restart();
  }

  play() {
    this.paused = false;
    this.narrator?.resume();
    this._emit();
    this._wake();
  }

  pause() {
    this.paused = true;
    this.narrator?.pause();
    this._emit();
  }

  setSpeed(speed) {
    this.speed = speed;
    this.narrator?.setRate(speed);
    this._emit();
  }

  setNarrate(narrate) {
    if (narrate === this.narrate) return;
    this.narrate = narrate;
    if (narrate) {
      this._prefetchCaptions();
      // Turned on mid-explanation: read out the caption on screen now.
      const status = this._status();
      if ((status === 'playing' || status === 'waiting') && this.captions.length) {
        this._speak(this.captions.at(-1));
      }
    } else {
      this._stopSpeech();
    }
    this._emit();
    this._wake();
  }

  setInstant(instant) {
    this.instant = instant;
  }

  /** PNG of the board (background + ink) at full board resolution. */
  toBlob() {
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_WIDTH;
    canvas.height = BOARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = BOARD_THEMES[this.theme].background;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    if (this.inkCanvas) ctx.drawImage(this.inkCanvas, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    if (this.sceneCanvas) ctx.drawImage(this.sceneCanvas, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  // -- state -------------------------------------------------------------------

  _resetPlayback() {
    this.next = 0;
    this.current = null;
    this.committed = [];
    this.items = new Map();
    this.flow = null;
    this.captions = [];
    this.clock = 0;
    this.captionHoldUntil = 0;
    this.pen = [MARGIN + 40, MARGIN + 90];
    // Primitives a compiled visual expanded into, drawn before the next action.
    this.expanded = [];
    this.stage = { stageY: STAGE.y };
    this.column = 'left';
    this.columnFlow = {};
    // Finished pages (a scene starts a new one), the current page's title, the camera zoom.
    this.pages = [];
    this.pageTitle = null;
    this.camera = null;
  }

  _restart() {
    this._stopSpeech();
    this._resetPlayback();
    if (this.narrate) this._prefetchCaptions();
    this.paused = false;
    this.scene.clear();
    this._clear(this.ink);
    this._clear(this.sceneCtx);
    this._clear(this.overlay);
    this._emit();
    this._wake();
  }

  _status() {
    if (!this.started) return 'idle';
    const pending =
      this.current !== null || this.expanded.length > 0 || this.next < this.actions.length;
    if (this.paused && (pending || this.streaming)) return 'paused';
    if (pending) return 'playing';
    return this.streaming ? 'waiting' : 'finished';
  }

  _buildSnapshot() {
    return {
      status: this._status(),
      captions: this.captions,
      speed: this.speed,
      narrate: this.narrate,
      pages: this.pages,
      pageTitle: this.pageTitle,
      camera: this.camera,
    };
  }

  _emit() {
    const next = this._buildSnapshot();
    const prev = this.snapshot;
    if (
      prev &&
      prev.status === next.status &&
      prev.captions === next.captions &&
      prev.speed === next.speed &&
      prev.narrate === next.narrate &&
      prev.pages === next.pages &&
      prev.pageTitle === next.pageTitle &&
      prev.camera === next.camera
    ) {
      return;
    }
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  // -- animation loop ----------------------------------------------------------

  /** Frames are needed while drawing, waiting for the stream, or anything is moving. */
  _needsFrames() {
    const status = this._status();
    return status === 'playing' || status === 'waiting' || this.scene.isAnimating(this.clock);
  }

  _wake() {
    if (this.raf || !this.ink || !this.pixelScale || !this.fontsReady || this.paused) return;
    if (!this._needsFrames()) return;
    this.raf = requestAnimationFrame(this._tick);
  }

  _tick = (now) => {
    this.raf = null;
    if (!this.ink) return;
    const dt = this.lastFrame === null ? 16 : Math.min(64, now - this.lastFrame);
    this.lastFrame = now;
    if (!this.paused) {
      this.clock += dt * this.speed;
      this._advance(dt * this.speed);
      this.scene.update(this.clock);
    }
    this._drawScene();
    this._drawOverlay(now);
    this._emit();
    if (!this.paused && this._needsFrames()) {
      this.raf = requestAnimationFrame(this._tick);
    } else {
      this.lastFrame = null;
    }
  };

  _advance(dt) {
    let budget = dt;
    for (let guard = 0; guard < 1000; guard += 1) {
      if (!this.current) {
        if (this.expanded.length) {
          const { action, seed } = this.expanded.shift();
          const plan = this._resolvePrimitive(action, seed);
          if (plan) this.current = { plan, elapsed: 0 };
          continue;
        }
        if (this.next >= this.actions.length) return;
        if (this._waitForMath(this.actions[this.next])) return;
        const index = this.next;
        this.next += 1;
        const plan = this._resolve(this.actions[index], index);
        if (plan) this.current = { plan, elapsed: 0 };
        continue;
      }

      const current = this.current;
      if (current.plan.kind === 'caption') {
        if (!this._captionReady()) return;
        this._showCaption(current.plan.text);
        this.current = null;
        continue;
      }

      const duration = this.instant ? 0 : current.plan.duration;
      const remaining = duration - current.elapsed;
      if (budget < remaining) {
        current.elapsed += budget;
        this._progress(current, false);
        return;
      }
      budget -= Math.max(0, remaining);
      current.elapsed = duration;
      this._progress(current, true);
      this.current = null;
    }
  }

  // -- captions & narration ------------------------------------------------------

  _captionReady() {
    const speaking = this.speaking && this.clock < this.speakingUntil;
    return this.clock >= this.captionHoldUntil && !speaking;
  }

  _showCaption(text) {
    this.captions = [...this.captions, text];
    this.captionHoldUntil =
      this.clock + Math.max(CAPTION_MIN_MS, text.length * CAPTION_MS_PER_CHAR);
    if (this.narrate) this._speak(text);
    this._emit();
  }

  _speak(text) {
    if (!this.narrator) return;
    this.speechToken += 1;
    const token = this.speechToken;
    this.speaking = true;
    this.speakingUntil = this.clock + SPEECH_TIMEOUT_MS;
    this.narrator.speak(text).then(() => {
      if (token !== this.speechToken) return;
      this.speaking = false;
      this._wake();
    });
  }

  _stopSpeech() {
    this.speechToken += 1;
    this.speaking = false;
    this.narrator?.stop();
  }

  /** Fetch audio for captions not yet shown, so each is ready when it appears. */
  _prefetchCaptions() {
    if (!this.narrator) return;
    const upcoming = this.current?.plan.kind === 'caption' ? [this.current.plan] : [];
    for (const action of this.actions.slice(this.next)) {
      if (action?.type === 'caption') upcoming.push(action);
    }
    upcoming.forEach(({ text }) => this.narrator.prefetch(text));
  }

  // -- turning actions into timed plans -----------------------------------------------

  /** True while a visual that evaluates expressions waits for mathjs to load. */
  _waitForMath(action) {
    if (!action || this.mathFailed || !needsMath(action) || isMathReady()) return false;
    loadMath()
      .catch(() => {
        this.mathFailed = true; // draw what we can (axes, labels) without the curves
      })
      .finally(() => this._wake());
    return true;
  }

  _resolve(action, index) {
    const rng = mulberry32(index + 1);
    if (action && isCompiled(action.type)) {
      const box = placeVisual(action, this.stage);
      const parts = expandAction(action, { box, measure: this._measureLabel });
      parts.forEach((part, i) =>
        this.expanded.push({ action: part, seed: (index + 1) * 1000 + i })
      );
      return null;
    }
    switch (action?.type) {
      case 'caption':
        return { kind: 'caption', text: action.text };
      case 'pause':
        return { kind: 'pause', duration: action.ms ?? 800 };
      case 'write':
        return this._resolveWrite(action);
      case 'line':
      case 'arrow':
      case 'rect':
      case 'circle':
        return this._shapePlan(action, rng);
      case 'column':
        this._switchColumn(action.side);
        return null;
      case 'scene':
        return this._startPage(action.title, index);
      case 'focus':
        this.camera = Array.isArray(action.at) ? action.at : null;
        return { kind: 'pause', duration: 600 };
      case 'box': {
        const item = this.items.get(action.id);
        if (!item) return null;
        item.boxed = true;
        const rect = [item.x - 16, item.y - 10, item.w + 32, item.h + 20];
        return this._strokePlan(rectStrokes(...rect, rng), action.color);
      }
      case 'underline': {
        const item = this.items.get(action.id);
        if (!item) return null;
        const y = item.baseline + item.size * 0.22;
        const line = wobblyLine([item.x - 4, y], [item.x + item.w + 6, y], rng);
        return this._strokePlan([line], action.color);
      }
      case 'erase': {
        if (action.id) {
          const item = this.items.get(action.id);
          if (!item) return null;
          this.items.delete(action.id);
          const pad = item.boxed ? 28 : 10;
          return this._erasePlan({
            x: item.x - pad,
            y: item.y - pad,
            w: item.w + pad * 2,
            h: item.h + pad * 2,
          });
        }
        return this._erasePlan({ x: action.x, y: action.y, w: action.w, h: action.h });
      }
      case 'object': {
        const object = this.scene.create(action, index + 1);
        if (!object) return null;
        const outline = object.outline?.flat() ?? null;
        const duration = outline ? Math.max(350, (pathLength(outline) / PEN_SPEED) * 1000) : POP_MS;
        return { kind: 'object', object, outline, duration };
      }
      case 'animate': {
        const wait = this.scene.animate(action, this.clock);
        return wait > 0 ? { kind: 'pause', duration: wait * 1000 } : null;
      }
      case 'stop':
        this.scene.stop(action.id, this.clock);
        return null;
      case 'remove':
        this.scene.remove(action.id, this.clock);
        return null;
      case 'clear':
        this._resetBoard();
        return this._erasePlan({ x: 0, y: 0, w: BOARD_WIDTH, h: BOARD_HEIGHT }, true);
      default:
        return null;
    }
  }

  _measure = (text, size) => {
    this.ink.font = handFont(size, FONT_WEIGHT);
    return this.ink.measureText(text).width;
  };

  /** Width of a label as the board will write it (maths text included). */
  _measureLabel = (text, px) => layoutMathText(String(text), px, this._measure).width;

  _shapePlan(action, rng) {
    switch (action.type) {
      case 'line':
        return this._strokePlan([wobblyLine(action.from, action.to, rng)], action.color);
      case 'arrow':
        return this._strokePlan(arrowStrokes(action.from, action.to, rng), action.color);
      case 'rect': {
        const { x, y, w, h } = action;
        const fill = action.fill ? { x, y, w, h } : null;
        return this._strokePlan(rectStrokes(x, y, w, h, rng), action.color, fill);
      }
      case 'circle':
        return this._strokePlan([circleStroke(action.x, action.y, action.r, rng)], action.color);
      default:
        return null;
    }
  }

  /** Everything a fresh board forgets: write positions, columns, the stage and objects. */
  _resetBoard() {
    this.items.clear();
    this.flow = null;
    this.column = 'left';
    this.columnFlow = {};
    this.stage.stageY = STAGE.y;
    this.camera = null;
    this.scene.removeAll(this.clock);
  }

  /** Keep the current page (title + thumbnail), wipe the board and write the new title. */
  _startPage(title, index) {
    if (this.committed.length || this.pageTitle) {
      const name = this.pageTitle ?? `Page ${this.pages.length + 1}`;
      this.pages = [...this.pages, { title: name, thumb: this._thumbnail() }];
    }
    this.pageTitle = title;
    this._resetBoard();
    const heading = { type: 'write', text: title, x: COLUMNS.left, y: MARGIN + 50, size: 'lg' };
    this.expanded.push({ action: { ...heading, color: 'blue' }, seed: (index + 1) * 1000 });
    return this._erasePlan({ x: 0, y: 0, w: BOARD_WIDTH, h: BOARD_HEIGHT }, true);
  }

  /** A small PNG of the ink so far, for the page strip (null where canvas isn't available). */
  _thumbnail() {
    try {
      const source = this.ink?.canvas;
      if (!source?.width) return null;
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = BOARD_THEMES[this.theme].background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  /** One primitive of a compiled visual (see compile/index.js), or a queued write. */
  _resolvePrimitive(part, seed) {
    const rng = mulberry32(seed);
    switch (part.type) {
      case 'write':
        return this._resolveWrite(part);
      case 'path':
        return this._pathPlan(part);
      case 'label':
        return this._labelPlan(part);
      case 'dot': {
        const fill = part.hollow ? null : { cx: part.x, cy: part.y, r: part.r, solid: true };
        return this._strokePlan([circleStroke(part.x, part.y, part.r, rng)], part.color, fill);
      }
      default:
        return this._shapePlan(part, rng);
    }
  }

  _pathPlan(part) {
    if (!Array.isArray(part.points) || part.points.length < 2) return null;
    const points = part.closed ? [...part.points, part.points[0]] : part.points;
    const plan = this._strokePlan([points], part.color, part.fill ? { points: part.points } : null);
    plan.style = { dash: part.dash, width: part.width };
    return plan;
  }

  _labelPlan(part) {
    const layout = layoutMathText(String(part.text), part.px ?? LABEL_PX, this._measure);
    const shift =
      part.align === 'center' ? layout.width / 2 : part.align === 'right' ? layout.width : 0;
    let time = 0;
    const glyphs = layout.glyphs.map((glyph) => {
      const timed = { ...glyph, start: time, end: time + glyphDuration(glyph) * LABEL_SPEED };
      time = timed.end;
      return timed;
    });
    return {
      kind: 'write',
      x: part.x - shift,
      y: part.y,
      color: part.color,
      glyphs,
      duration: time,
      done: 0,
    };
  }

  _switchColumn(side) {
    this.columnFlow[this.column] = this.flow;
    this.column = COLUMNS[side] === undefined ? 'left' : side;
    this.flow = this.columnFlow[this.column] ?? null;
  }

  _resolveWrite(action) {
    let size = FONT_SIZES[action.size] ?? FONT_SIZES.md;
    const prev = this.flow;
    const column = action.x ?? prev?.column ?? COLUMNS[this.column];
    let y = action.y ?? (prev ? prev.y + Math.max(prev.size, size) * LINE_SPACING : MARGIN + size);

    let layout = layoutMathText(action.text, size, this._measure);
    const room = BOARD_WIDTH - EDGE - column;
    if (layout.width > room) {
      // Shrink a little to fit; beyond that, slide the text left.
      size = Math.max(size * 0.6, size * (room / layout.width));
      layout = layoutMathText(action.text, size, this._measure);
    }
    const x = Math.max(EDGE, Math.min(column, BOARD_WIDTH - EDGE - layout.width));
    y = Math.min(Math.max(y, size * 0.85 + EDGE / 2), BOARD_HEIGHT - size * 0.3 - EDGE / 2);
    this.flow = { column, y, size };

    const bounds = { x, y: y - size * 0.82, w: layout.width, h: size * 1.12, baseline: y, size };
    if (action.id) this.items.set(action.id, bounds);

    let time = 0;
    const glyphs = layout.glyphs.map((glyph) => {
      const timed = { ...glyph, start: time, end: time + glyphDuration(glyph) };
      time = timed.end;
      return timed;
    });
    return { kind: 'write', x, y, color: action.color, glyphs, duration: time, done: 0 };
  }

  _strokePlan(strokes, color, fill = null) {
    let time = fill ? FILL_MS : 0;
    const timed = strokes.map((points) => {
      const duration = Math.max(110, (pathLength(points) / PEN_SPEED) * 1000);
      const stroke = { points, start: time, end: time + duration };
      time = stroke.end + PEN_LIFT_MS;
      return stroke;
    });
    return {
      kind: 'strokes',
      strokes: timed,
      color,
      fill,
      fillDone: false,
      duration: time - PEN_LIFT_MS,
      done: 0,
    };
  }

  _erasePlan(rect, wholeBoard = false) {
    const eraserHeight = wholeBoard ? 150 : Math.min(64, Math.max(28, rect.h));
    // Keep the duster's band inside the rectangle: rows run from top+h/2 to bottom-h/2.
    const inset = Math.min(eraserHeight / 2, rect.h / 2);
    const path = eraserPath(rect.x, rect.y + inset, rect.w, rect.h - inset * 2, eraserHeight);
    const speed = wholeBoard ? CLEAR_SPEED : ERASER_SPEED;
    return {
      kind: 'erase',
      rect,
      path,
      eraserHeight,
      scale: wholeBoard ? 1.5 : 1,
      wholeBoard,
      duration: Math.max(300, (pathLength(path) / speed) * 1000),
    };
  }

  // -- drawing -----------------------------------------------------------------------

  _clear(ctx) {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (this.pixelScale) ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
  }

  _color(name) {
    return colorOf(this.theme, name);
  }

  _drawGlyph(ctx, plan, glyph) {
    ctx.font = handFont(glyph.size, FONT_WEIGHT);
    ctx.fillStyle = this._color(plan.color);
    ctx.fillText(glyph.char, plan.x + glyph.x, plan.y + glyph.dy);
  }

  _drawFill(ctx, plan, alpha = 1) {
    const { fill } = plan;
    ctx.save();
    ctx.globalAlpha = (fill.solid ? 1 : BOARD_THEMES[this.theme].fillAlpha) * alpha;
    ctx.fillStyle = this._color(plan.color);
    if (fill.points) {
      tracePath(ctx, fill.points);
      ctx.closePath();
      ctx.fill();
    } else if (fill.r !== undefined) {
      ctx.beginPath();
      ctx.arc(fill.cx, fill.cy, fill.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(fill.x, fill.y, fill.w, fill.h);
    }
    ctx.restore();
  }

  _erase(plan, t) {
    const ctx = this.ink;
    if (t >= 1) {
      ctx.clearRect(plan.rect.x, plan.rect.y, plan.rect.w, plan.rect.h);
      return;
    }
    // Erasing is idempotent, so re-stroking the whole path so far is fine.
    ctx.save();
    ctx.beginPath();
    ctx.rect(plan.rect.x, plan.rect.y, plan.rect.w, plan.rect.h);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    tracePath(ctx, partialPath(plan.path, t));
    ctx.lineWidth = plan.eraserHeight;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  /** Commit to the ink canvas whatever has finished by `current.elapsed`. */
  _progress(current, complete) {
    const { plan, elapsed } = current;
    const ctx = this.ink;
    if (plan.kind === 'write') {
      while (
        plan.done < plan.glyphs.length &&
        (complete || plan.glyphs[plan.done].end <= elapsed)
      ) {
        this._drawGlyph(ctx, plan, plan.glyphs[plan.done]);
        plan.done += 1;
      }
    } else if (plan.kind === 'strokes') {
      if (plan.fill && !plan.fillDone && (complete || elapsed >= FILL_MS)) {
        this._drawFill(ctx, plan);
        plan.fillDone = true;
      }
      while (
        plan.done < plan.strokes.length &&
        (complete || plan.strokes[plan.done].end <= elapsed)
      ) {
        strokePath(ctx, plan.strokes[plan.done].points, this._color(plan.color), plan.style);
        plan.done += 1;
      }
    } else if (plan.kind === 'erase') {
      this._erase(plan, complete ? 1 : elapsed / plan.duration);
    }

    if (!complete) return;
    if (plan.kind === 'object') {
      // Objects live on the scene layer (they may move), not in the ink.
      this.scene.add(plan.object);
    } else if (plan.kind === 'erase' && plan.wholeBoard) {
      this.committed = [];
    } else if (plan.kind !== 'pause') {
      this.committed.push(plan);
    }
  }

  _redraw() {
    if (!this.ink || !this.pixelScale) return;
    this._clear(this.ink);
    const ctx = this.ink;
    for (const plan of this.committed) {
      if (plan.kind === 'write') plan.glyphs.forEach((glyph) => this._drawGlyph(ctx, plan, glyph));
      if (plan.kind === 'strokes') {
        if (plan.fill) this._drawFill(ctx, plan);
        plan.strokes.forEach((stroke) =>
          strokePath(ctx, stroke.points, this._color(plan.color), plan.style)
        );
      }
      if (plan.kind === 'erase') ctx.clearRect(plan.rect.x, plan.rect.y, plan.rect.w, plan.rect.h);
    }
    // The action in progress: redraw just the parts already committed.
    const current = this.current;
    if (!current) return;
    const { plan } = current;
    if (plan.kind === 'write') {
      plan.glyphs.slice(0, plan.done).forEach((glyph) => this._drawGlyph(ctx, plan, glyph));
    } else if (plan.kind === 'strokes') {
      if (plan.fillDone) this._drawFill(ctx, plan);
      plan.strokes
        .slice(0, plan.done)
        .forEach((stroke) => strokePath(ctx, stroke.points, this._color(plan.color), plan.style));
    } else if (plan.kind === 'erase') {
      this._erase(plan, current.elapsed / plan.duration);
    }
  }

  _drawScene() {
    const ctx = this.sceneCtx;
    if (!ctx || !this.pixelScale) return;
    this._clear(ctx);
    if (!this.scene.isEmpty) this.scene.draw(ctx, this.theme, this.clock);
  }

  /** The object being placed: its outline traced by the pencil, or a quick pop-in. */
  _drawPlacing(ctx, plan, k) {
    const { object } = plan;
    const pose = this.scene.poseOf(object, this.clock);
    if (object.def.shape === 'arrow') {
      this.scene.drawArrow(ctx, object, this.theme, k);
      return this.scene.arrowGeometry(object)?.end ?? [pose.x, pose.y];
    }
    if (plan.outline) {
      const points = partialPath(plan.outline, k).map(([x, y]) => [pose.x + x, pose.y + y]);
      strokePath(ctx, points, this._color(object.def.color));
      return points.at(-1);
    }
    drawObject(ctx, object, pose, this.theme, { scale: Math.max(0.01, easeOutBack(k)) });
    return [pose.x + object.half * 0.7, pose.y - object.half * 0.2];
  }

  _drawOverlay(now) {
    const ctx = this.overlay;
    if (!ctx || !this.pixelScale) return;
    this._clear(ctx);
    const status = this._status();
    if (status === 'idle' || status === 'finished') return;

    const current = this.current;
    const plan = current?.plan;
    let tip = null;
    let lifted = 0;

    if (plan?.kind === 'write') {
      const glyph = plan.glyphs[plan.done];
      if (glyph) {
        const k = clamp01((current.elapsed - glyph.start) / (glyph.end - glyph.start));
        const top = plan.y + glyph.dy - glyph.size;
        ctx.save();
        ctx.beginPath();
        ctx.rect(plan.x + glyph.x - 2, top, (glyph.width + 4) * k, glyph.size * 1.5);
        ctx.clip();
        this._drawGlyph(ctx, plan, glyph);
        ctx.restore();
        const wiggle = Math.sin(k * Math.PI * 3) * glyph.size * 0.18;
        tip = [plan.x + glyph.x + glyph.width * k, plan.y + glyph.dy - glyph.size * 0.28 + wiggle];
      }
    } else if (plan?.kind === 'strokes') {
      if (plan.fill && !plan.fillDone) {
        this._drawFill(ctx, plan, clamp01(current.elapsed / FILL_MS));
        tip = fillCenter(plan.fill);
        lifted = 10;
      }
      const stroke = plan.strokes[plan.done];
      if (stroke && current.elapsed >= stroke.start) {
        const k = clamp01((current.elapsed - stroke.start) / (stroke.end - stroke.start));
        const points = partialPath(stroke.points, k);
        strokePath(ctx, points, this._color(plan.color), plan.style);
        tip = points.at(-1);
      } else if (stroke && plan.done > 0) {
        // Pen lifted, travelling to the start of the next stroke.
        const from = plan.strokes[plan.done - 1].points.at(-1);
        const to = stroke.points[0];
        const k = clamp01(1 - (stroke.start - current.elapsed) / PEN_LIFT_MS);
        tip = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
        lifted = Math.sin(k * Math.PI) * 14;
      }
    } else if (plan?.kind === 'object') {
      tip = this._drawPlacing(ctx, plan, clamp01(current.elapsed / plan.duration));
      lifted = plan.outline ? 0 : Math.sin(clamp01(current.elapsed / plan.duration) * Math.PI) * 14;
    } else if (plan?.kind === 'erase') {
      const point = partialPath(plan.path, clamp01(current.elapsed / plan.duration)).at(-1);
      drawDuster(ctx, point[0], point[1], plan.scale);
      return;
    }

    if (tip) {
      this.pen = tip;
    } else {
      // Waiting for the next step: the pencil hovers, tapping gently.
      lifted = 8 + Math.sin(now / 260) * 6;
    }
    drawPencil(ctx, this.pen[0], this.pen[1], { lifted });
  }
}
