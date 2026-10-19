import { BoardPlayer } from './BoardPlayer';
import { attachFakeCanvas, drain } from './testCanvas';

const caption = (text) => ({ type: 'caption', text });
const write = (text, extra = {}) => ({ type: 'write', text, ...extra });
const QUESTION = { type: 'ask', id: 'q1', kind: 'number', unit: 'cm' };

function livePlayer(actions = []) {
  const player = attachFakeCanvas(new BoardPlayer());
  player.begin();
  actions.forEach((action) => player.enqueue(action));
  return player;
}

describe('BoardPlayer: cutting at the end of a step', () => {
  it('cut drops the steps not yet started', () => {
    const player = livePlayer([caption('c1'), write('w1')]);
    drain(player);
    [caption('c2'), write('w2'), caption('c3')].forEach((action) => player.enqueue(action));

    expect(player.stepEnd()).toBe(2);
    expect(player.keepCount(2)).toBe(2);
    player.cut(2);
    expect(player.actions).toHaveLength(2);
  });

  it('never cuts what has already been drawn', () => {
    const player = livePlayer([caption('c1'), write('w1'), caption('c2')]);
    drain(player);
    player.cut(1);
    expect(player.actions).toHaveLength(3);
  });

  it("keepCount counts only the latest turn's own actions", () => {
    const player = livePlayer([caption('c1'), write('w1')]);
    drain(player);
    player.extend();
    [caption('r1'), QUESTION].forEach((action) => player.enqueue(action));
    drain(player);
    player.answerAsk({ text: '12', correct: true, say: 'Correct!', release: true });

    expect(player.keepCount(player.actions.length)).toBe(2);
  });
});

describe('BoardPlayer: questions', () => {
  it('a live question waits for the answer', () => {
    const player = livePlayer([caption('What is the area?'), QUESTION, caption('Well done.')]);
    drain(player);

    let snapshot = player.getSnapshot();
    expect(snapshot.status).toBe('asking');
    expect(snapshot.ask).toMatchObject({ id: 'q1', kind: 'number', unit: 'cm' });
    expect(snapshot.ask.answer).toBeUndefined();
    expect(snapshot.captions).toEqual(['What is the area?']);

    const after = player.answerAsk({ text: '12', correct: true, say: 'Correct!', release: true });
    expect(after).toBe(4); // caption, question, then the answer and 'Correct!'
    player.endStream();
    drain(player);

    snapshot = player.getSnapshot();
    expect(snapshot.status).toBe('finished');
    expect(snapshot.ask).toBeNull();
    expect(snapshot.captions).toEqual(['What is the area?', 'Correct!', 'Well done.']);
    expect(player.actions).toContainEqual(
      expect.objectContaining({ type: 'answer', text: '12', correct: true, local: true })
    );
  });

  it('a wrong answer keeps the question open', () => {
    const player = livePlayer([caption('Area?'), QUESTION]);
    drain(player);

    player.answerAsk({ text: '14', correct: false, say: 'Not quite.', release: false });
    drain(player);

    const snapshot = player.getSnapshot();
    expect(snapshot.status).toBe('asking');
    expect(snapshot.ask.id).toBe('q1');
    expect(snapshot.captions.at(-1)).toBe('Not quite.');
  });

  it('skipping a question moves on', () => {
    const player = livePlayer([QUESTION, caption('Here is how.')]);
    drain(player);
    player.skipAsk();
    player.endStream();
    drain(player);
    expect(player.getSnapshot().status).toBe('finished');
  });

  it("questions don't wait in a replay", () => {
    const player = attachFakeCanvas(new BoardPlayer());
    const answer = { type: 'answer', ask: 'q1', text: '12', correct: true };
    player.load([caption('Area?'), QUESTION, answer]);
    drain(player);
    expect(player.getSnapshot().status).toBe('finished');
  });

  it('a mark on an unknown write is ignored, and verdicts draw nothing', () => {
    const player = livePlayer([
      write('15 cm', { id: 's1' }),
      { type: 'mark', id: 's1', kind: 'cross', note: 'sign error' },
      { type: 'mark', id: 'nope', kind: 'tick' },
      { type: 'verdict', ask: 'q1', correct: false },
    ]);
    player.endStream();
    drain(player);
    expect(player.getSnapshot().status).toBe('finished');
  });
});

describe('BoardPlayer: page overflow', () => {
  it('a long column continues on a new page', () => {
    const player = livePlayer([{ type: 'scene', title: 'Lens' }]);
    for (let n = 0; n < 40; n += 1) player.enqueue(write(`line ${n}`));
    player.endStream();
    drain(player);

    const snapshot = player.getSnapshot();
    expect(snapshot.pages.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.pageTitle).toBe('Lens (contd.)');
  });
});

describe('BoardPlayer: listening', () => {
  it('duck turns narration down while the mic listens', () => {
    const player = new BoardPlayer();
    const narrator = { setRate: vi.fn(), setVolume: vi.fn() };
    player.setNarrator(narrator);

    player.duck(true);
    player.duck(false);

    expect(narrator.setVolume.mock.calls).toEqual([[0.2], [1]]);
  });
});

describe('BoardPlayer: review fixes', () => {
  it('a replay does not stop at questions already answered', () => {
    const player = livePlayer([caption('Area?'), QUESTION]);
    drain(player);
    player.answerAsk({ text: '12', correct: true, release: true });
    player.endStream();
    drain(player);

    player.replay();
    drain(player);

    expect(player.getSnapshot().status).toBe('finished');
  });

  it("questions from earlier turns don't wait once a new turn starts", () => {
    const player = attachFakeCanvas(new BoardPlayer());
    player.load([caption('Area?'), QUESTION]);
    player.extend();
    player.enqueue(caption('Next part.'));
    player.endStream();
    drain(player);

    expect(player.getSnapshot().status).toBe('finished');
  });

  it('keepCount is 0 for a point before the latest turn', () => {
    const player = livePlayer([caption('c1'), write('w1')]);
    player.extend();
    player.enqueue(caption('c2'));
    expect(player.keepCount(1)).toBe(0);
  });

  it('a new question with the same id shows its own options', () => {
    const first = { type: 'ask', id: 'q1', kind: 'choice', options: ['4', '8', '16'] };
    const second = { type: 'ask', id: 'q1', kind: 'choice', options: ['a', 'b', 'c'] };
    const player = livePlayer([first]);
    drain(player);
    player.answerAsk({ text: 'B', correct: true, release: true });
    player.enqueue(second);
    drain(player);

    expect(player.getSnapshot().ask.options).toEqual(['a', 'b', 'c']);
  });

  it('a turn that fails to start gets back the actions it cut', () => {
    const player = livePlayer([caption('c1'), write('w1')]);
    drain(player);
    [caption('c2'), write('w2')].forEach((action) => player.enqueue(action));

    const removed = player.cut(2);
    player.extend();
    player.restore(removed);

    expect(removed).toHaveLength(2);
    expect(player.actions.map((action) => action.text)).toEqual(['c1', 'w1', 'c2', 'w2']);
    expect(player.turnOffset).toBe(0);
  });
});


describe('BoardPlayer: the bottom edge', () => {
  /** How many writes after a scene fit on one page (the next one starts a new page). */
  function writesPerPage() {
    const probe = livePlayer([{ type: 'scene', title: 'Area' }]);
    for (let n = 1; n < 60; n += 1) {
      probe.enqueue(write(`line ${n}`));
      drain(probe);
      if (probe.getSnapshot().pages.length > 0) return n - 1; // the scene's own page is not kept
    }
    throw new Error('the column never filled');
  }

  it('a question at the bottom of a full page goes to a new page', () => {
    const fit = writesPerPage();
    const player = livePlayer([{ type: 'scene', title: 'Area' }]);
    for (let n = 0; n < fit; n += 1) player.enqueue(write(`line ${n}`));
    player.enqueue(QUESTION);
    drain(player);

    expect(player.getSnapshot().pageTitle).toBe('Area (contd.)');
    expect(player.getSnapshot().status).toBe('asking');
  });

  it("the student's answer at the bottom of a full page goes to a new page", () => {
    const fit = writesPerPage();
    const player = attachFakeCanvas(new BoardPlayer());
    const lines = Array.from({ length: fit }, (_, n) => write(`line ${n}`));
    const answer = { type: 'answer', ask: 'q1', text: '12', correct: true };
    player.load([{ type: 'scene', title: 'Area' }, ...lines, answer]);
    drain(player);

    expect(player.getSnapshot().pageTitle).toBe('Area (contd.)');
  });
});
