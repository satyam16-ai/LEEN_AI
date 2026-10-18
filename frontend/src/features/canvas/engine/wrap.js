/** Split text at spaces into lines no wider than maxWidth (a single long word keeps its own line). */
export function wrapWords(text, maxWidth, widthOf) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [String(text)];
  const lines = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (widthOf(candidate) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}
