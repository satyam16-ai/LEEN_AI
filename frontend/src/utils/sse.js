/**
 * Incremental parser for a text/event-stream body. Feed it decoded chunks in any
 * size; it calls `onEvent(name, data)` for every complete event. `data` is
 * JSON-parsed when possible. Comment lines (": ping") are ignored.
 */
export function createSSEParser(onEvent) {
  let buffer = '';
  let eventName = 'message';
  let dataLines = [];

  const dispatch = () => {
    if (dataLines.length) {
      const raw = dataLines.join('\n');
      let data = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        /* plain-text data */
      }
      onEvent(eventName, data);
    }
    eventName = 'message';
    dataLines = [];
  };

  const handleLine = (line) => {
    if (line === '') return dispatch();
    if (line.startsWith(':')) return undefined;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
    return undefined;
  };

  return {
    feed(chunk) {
      buffer += chunk;
      // A trailing \r may be the first half of \r\n; keep it until the next chunk.
      const held = buffer.endsWith('\r');
      const lines = (held ? buffer.slice(0, -1) : buffer).split(/\r\n|\r|\n/);
      buffer = lines.pop() + (held ? '\r' : '');
      lines.forEach(handleLine);
    },
    end() {
      if (buffer) handleLine(buffer.replace(/\r$/, ''));
      buffer = '';
      dispatch();
    },
  };
}
