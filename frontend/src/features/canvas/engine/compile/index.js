/**
 * Visual compilers: each turns one short AI command (plot, geo, flow, …) into
 * the primitives the pencil already knows how to draw:
 *   path  {points, color, closed?, dash?, fill?}   a smooth stroke (optionally filled)
 *   label {text, x, y, px, color, align}            handwriting at a fixed spot
 *   dot   {x, y, r, color, hollow?}                 a point marker
 * plus the v1 shapes line, arrow, rect and circle. Compilers are pure functions of
 * (action, {box, measure}) so they can be tested without a canvas.
 */

import { compileChart } from './chart';
import { compileDiagram } from './diagram';
import { compileFlow } from './flow';
import { compileGeo } from './geo';
import { compileNumberLine } from './numberline';
import { compilePlot } from './plot';
import { compileTable } from './table';

export const COMPILERS = {
  plot: compilePlot,
  numberline: compileNumberLine,
  geo: compileGeo,
  table: compileTable,
  chart: compileChart,
  flow: compileFlow,
  diagram: compileDiagram,
};

export function isCompiled(type) {
  return Object.hasOwn(COMPILERS, type);
}

/** Visuals that evaluate expressions need mathjs loaded first. */
export function needsMath(action) {
  return action.type === 'plot' || (action.type === 'table' && Boolean(action.fn));
}

/** The primitives for `action`; never throws, so one bad visual can't stop the board. */
export function expandAction(action, ctx) {
  try {
    const parts = COMPILERS[action.type]?.(action, ctx);
    return Array.isArray(parts) ? parts : [];
  } catch (error) {
    if (import.meta.env.DEV) console.warn(`Could not draw ${action.type}`, error);
    return [];
  }
}
