/**
 * Tiny maths markup used on the board and in captions:
 *   x^2, (x+y)^{2}, a^{n+1}, x^-1  -> superscript
 *   a_1, x_{n}                     -> subscript
 */

const SCRIPT_SCALE = 0.62;
const SUPER_RAISE = 0.42;
const SUB_DROP = 0.18;

function readScript(text, start) {
  if (text[start] === '{') {
    const end = text.indexOf('}', start + 1);
    if (end === -1) return { value: text.slice(start + 1), next: text.length };
    return { value: text.slice(start + 1, end), next: end + 1 };
  }
  // A signed run of digits (x^10, x^-1), otherwise a single character (x^n).
  const match = /^[-−]?\d+/.exec(text.slice(start));
  if (match) return { value: match[0], next: start + match[0].length };
  return { value: text[start] ?? '', next: start + 1 };
}

/** Split text into runs: { text, script: 'base' | 'sup' | 'sub' }. */
export function parseMathText(text) {
  const runs = [];
  const push = (value, script) => {
    if (!value) return;
    const last = runs.at(-1);
    if (last && last.script === script) last.text += value;
    else runs.push({ text: value, script });
  };

  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const isMarker = (char === '^' || char === '_') && i + 1 < text.length && i > 0;
    if (isMarker) {
      const { value, next } = readScript(text, i + 1);
      push(value, char === '^' ? 'sup' : 'sub');
      i = next;
    } else {
      push(char, 'base');
      i += 1;
    }
  }
  return runs;
}

/**
 * Lay out text as individual glyphs (so the pencil can write them one by one).
 * `measure(string, fontSize)` returns the advance width.
 * Returns glyph positions relative to the baseline start, plus the total width.
 */
export function layoutMathText(text, size, measure) {
  const glyphs = [];
  let x = 0;
  for (const run of parseMathText(text)) {
    const glyphSize = run.script === 'base' ? size : size * SCRIPT_SCALE;
    const dy =
      run.script === 'sup' ? -size * SUPER_RAISE : run.script === 'sub' ? size * SUB_DROP : 0;
    for (const char of run.text) {
      const width = measure(char, glyphSize);
      glyphs.push({ char, x, dy, size: glyphSize, width });
      x += width;
    }
  }
  return { glyphs, width: x };
}

const SYMBOLS = [
  [/\s*[×✕]\s*/g, ' times '],
  [/\s*÷\s*/g, ' divided by '],
  [/\s*≠\s*/g, ' is not equal to '],
  [/\s*≤\s*/g, ' is less than or equal to '],
  [/\s*≥\s*/g, ' is greater than or equal to '],
  [/\s*±\s*/g, ' plus or minus '],
  [/\s*→\s*/g, ' gives '],
  [/\s*=\s*/g, ' equals '],
  [/\s*\+\s*/g, ' plus '],
  [/\s*−\s*/g, ' minus '],
  // A hyphen between numbers or single-letter variables is a minus (not "step-by-step").
  [/(\b[a-z]\b|\d|\))\s*-\s*(?=\b[a-z]\b|\d|\()/gi, '$1 minus '],
  [/√/g, ' square root of '],
  [/π/g, ' pi '],
  [/½/g, ' half '],
  [/°/g, ' degrees '],
  [/·/g, ' '],
  // "2xy" -> "2 x y", "xy" -> "x y": read variables letter by letter.
  [/\b(\d+)([abcxyz]{1,3})\b/g, (_, digits, letters) => `${digits} ${letters.split('').join(' ')}`],
  [/\b([xyz])([xyz])([xyz])?\b/g, (match) => match.split('').join(' ')],
];

/**
 * Spoken form for narration, read the way a teacher says it:
 * "(x+y)^2 = x^2 + 2xy" -> "(x plus y) whole squared equals x squared plus 2 x y".
 */
export function speakableText(text) {
  let spoken = '';
  for (const { text: value, script } of parseMathText(text)) {
    if (script === 'sup') {
      const whole = spoken.trimEnd().endsWith(')') ? ' whole' : '';
      const power = value === '2' ? 'squared' : value === '3' ? 'cubed' : `to the power ${value}`;
      spoken += `${whole} ${power}`;
    } else if (script === 'sub') {
      spoken += ` sub ${value}`;
    } else {
      spoken += value;
    }
  }
  for (const [pattern, replacement] of SYMBOLS) spoken = spoken.replace(pattern, replacement);
  return spoken.replace(/\s+/g, ' ').trim();
}
