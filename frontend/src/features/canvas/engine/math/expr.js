/**
 * The board's math engine: turns the short expressions the AI sends ("x^2-4",
 * "sin(x)") into JavaScript functions, so curves and tables are computed here,
 * not written out by the AI. mathjs is loaded on demand (it is large), and every
 * expression is checked against a whitelist of node types and names before it
 * is compiled, so nothing but arithmetic on x can run.
 */

export const ALLOWED_FUNCTIONS = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'abs',
  'log',
  'ln',
  'exp',
  'log10',
  'floor',
  'ceil',
];
const ALLOWED_SYMBOLS = new Set(['x', 'pi', 'e']);
const FUNCTIONS = new Set(ALLOWED_FUNCTIONS);
const MAX_LENGTH = 80;

let math = null;
let loading = null;

/** Load mathjs once; later calls return the same promise. */
export function loadMath() {
  loading ??= import('mathjs').then(({ create, all }) => {
    const instance = create(all);
    instance.import({ ln: (value) => instance.log(value) }, { override: false });
    math = instance;
  });
  return loading;
}

export function isMathReady() {
  return math !== null;
}

function isSafe(tree) {
  let safe = true;
  tree.traverse((node, path, parent) => {
    if (!safe) return;
    switch (node.type) {
      case 'ConstantNode':
        safe = typeof node.value === 'number';
        break;
      case 'OperatorNode':
      case 'ParenthesisNode':
        break;
      case 'FunctionNode':
        safe = node.fn?.type === 'SymbolNode' && FUNCTIONS.has(node.fn.name);
        break;
      case 'SymbolNode':
        safe =
          parent?.type === 'FunctionNode' && path === 'fn'
            ? FUNCTIONS.has(node.name)
            : ALLOWED_SYMBOLS.has(node.name);
        break;
      default:
        safe = false;
    }
  });
  return safe;
}

/** A function of x for `source`, or null if mathjs isn't loaded or the expression isn't allowed. */
export function compileExpr(source) {
  if (!math || typeof source !== 'string') return null;
  const text = source.trim();
  if (!text || text.length > MAX_LENGTH) return null;
  let compiled;
  try {
    const tree = math.parse(text);
    if (!isSafe(tree)) return null;
    compiled = tree.compile();
  } catch {
    return null;
  }
  return (x) => {
    try {
      const value = compiled.evaluate({ x });
      return typeof value === 'number' && Number.isFinite(value) ? value : NaN;
    } catch {
      return NaN;
    }
  };
}

/**
 * Sample fn at n + 1 evenly spaced points of [x0, x1]. The curve is split into
 * separate segments where it is undefined, and across jumps bigger than half the
 * sampled y-range (asymptotes such as 1/x or tan x), so no line crosses the gap.
 */
export function sampleFunction(fn, [x0, x1], n = 240) {
  const points = [];
  for (let i = 0; i <= n; i += 1) {
    const x = x0 + ((x1 - x0) * i) / n;
    points.push([x, fn(x)]);
  }
  const ys = points.map(([, y]) => y).filter(Number.isFinite);
  const span = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;

  const segments = [];
  let current = [];
  for (const point of points) {
    const previous = current.at(-1);
    const jump = previous && span > 0 && Math.abs(point[1] - previous[1]) > span / 2;
    if (!Number.isFinite(point[1]) || jump) {
      if (current.length > 1) segments.push(current);
      current = Number.isFinite(point[1]) ? [point] : [];
      continue;
    }
    current.push(point);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}
