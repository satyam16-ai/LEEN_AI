const ELLIPSIS = '…';

/** `text` shortened with an ellipsis so it measures no wider than maxWidth at px. */
export function fitText(text, px, maxWidth, measure) {
  const value = String(text);
  if (measure(value, px) <= maxWidth) return value;
  for (let length = value.length - 1; length > 0; length -= 1) {
    const candidate = value.slice(0, length).trimEnd() + ELLIPSIS;
    if (measure(candidate, px) <= maxWidth) return candidate;
  }
  return '';
}
