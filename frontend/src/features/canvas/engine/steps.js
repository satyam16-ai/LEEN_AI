/**
 * Where the current step of an explanation ends: the first caption at or after `next`
 * (the action the board will start next), or the end of the list. A step is a caption
 * and everything drawn for it, so cutting here lets the student's message wait until
 * the teacher has finished the point being made.
 */
export function stepEnd(actions, next) {
  for (let index = next; index < actions.length; index += 1) {
    if (actions[index]?.type === 'caption') return index;
  }
  return actions.length;
}
