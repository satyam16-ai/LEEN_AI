import { compileApparatus } from './apparatus';
import { compileAtom } from './atom';
import { compileCell } from './cell';
import { compileCircuit } from './circuit';
import { compileFbd } from './fbd';
import { label } from './labels';
import { compileOptics } from './optics';

const TEMPLATES = {
  circuit: compileCircuit,
  lens: compileOptics,
  mirror: compileOptics,
  fbd: compileFbd,
  atom: compileAtom,
  cell: compileCell,
  apparatus: compileApparatus,
};
const TITLE_SPACE = 36;

/** A science diagram from a named template; the board computes every part's position. */
export function compileDiagram(action, ctx) {
  if (!Object.hasOwn(TEMPLATES, action.kind)) return [];
  const { box } = ctx;
  if (!action.title) return TEMPLATES[action.kind](action, ctx);
  const below = { ...box, y: box.y + TITLE_SPACE, h: box.h - TITLE_SPACE };
  return [
    label(action.title, box.x + box.w / 2, box.y + 26, { color: action.color ?? 'ink' }),
    ...TEMPLATES[action.kind](action, { ...ctx, box: below }),
  ];
}
