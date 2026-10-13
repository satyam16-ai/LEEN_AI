import { parseMathText } from '../engine/mathText';

/** Renders the board's maths markup (x^2, a_1) as real superscripts/subscripts. */
export function MathText({ text }) {
  return parseMathText(text).map((run, index) => {
    if (run.script === 'sup') return <sup key={index}>{run.text}</sup>;
    if (run.script === 'sub') return <sub key={index}>{run.text}</sub>;
    return <span key={index}>{run.text}</span>;
  });
}
