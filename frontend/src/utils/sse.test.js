import { createSSEParser } from './sse';

const STREAM =
  'event: doubt\ndata: {"id":"d1"}\n\n' +
  ': ping\n\n' +
  'event: action\ndata: {"type":"write","text":"x^2"}\n\n' +
  'event: done\r\ndata: {"count":1}\r\n\r\n';

function collect(chunks) {
  const events = [];
  const parser = createSSEParser((name, data) => events.push([name, data]));
  chunks.forEach((chunk) => parser.feed(chunk));
  parser.end();
  return events;
}

describe('createSSEParser', () => {
  it.each([1, 4, 17, STREAM.length])('parses events split into %i-character chunks', (size) => {
    const chunks = [];
    for (let i = 0; i < STREAM.length; i += size) chunks.push(STREAM.slice(i, i + size));

    expect(collect(chunks)).toEqual([
      ['doubt', { id: 'd1' }],
      ['action', { type: 'write', text: 'x^2' }],
      ['done', { count: 1 }],
    ]);
  });

  it('keeps non-JSON data as text and flushes a final event without a blank line', () => {
    expect(collect(['data: hello\ndata: world\n\nevent: error\ndata: {"message":"x"}'])).toEqual([
      ['message', 'hello\nworld'],
      ['error', { message: 'x' }],
    ]);
  });
});
