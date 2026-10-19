import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';

import { BoardPlayer } from '@/features/canvas/engine/BoardPlayer';
import { attachFakeCanvas, drain } from '@/features/canvas/engine/testCanvas';
import { doubtService } from '@/services/doubtService';

import { useDoubtSession } from './useDoubtSession';

vi.mock('@/services/doubtService', () => ({
  doubtService: { stream: vi.fn(), streamTurn: vi.fn(), answer: vi.fn() },
}));

const QUESTION = { id: 'q1', kind: 'number', unit: 'cm' };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakePlayer(status = 'playing') {
  return {
    status,
    ask: null,
    next: 4,
    actions: [{}, {}, {}, {}, {}, {}],
    getSnapshot() {
      return { status: this.status, ask: this.ask };
    },
    begin: vi.fn(),
    extend: vi.fn(),
    enqueue: vi.fn(),
    endStream: vi.fn(),
    stepEnd: vi.fn(() => 3),
    keepCount: vi.fn((at) => at),
    cut: vi.fn(),
    answerAsk: vi.fn(() => 7),
    skipAsk: vi.fn(),
  };
}

function wrapper({ children }) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children);
}

/** A doubt whose first turn has finished streaming. */
async function askedDoubt(player) {
  doubtService.stream.mockImplementation((body, { onEvent }) => {
    onEvent('doubt', { id: 'd1', question: body.question });
    onEvent('done', { id: 'd1' });
    return Promise.resolve();
  });
  const hook = renderHook(() => useDoubtSession(player), { wrapper });
  await act(async () => {
    await hook.result.current.ask({ question: 'Where is the image?' });
  });
  return hook;
}

beforeEach(() => {
  doubtService.streamTurn.mockImplementation((id, body, { onEvent }) => {
    onEvent('done', { id });
    return Promise.resolve();
  });
});

afterEach(() => vi.clearAllMocks());

describe('useDoubtSession: talking mid-explanation', () => {
  it('say() while the AI is still writing waits for done, then sends keep once', async () => {
    let finish;
    doubtService.stream.mockImplementation(
      (body, { onEvent }) =>
        new Promise((resolve) => {
          onEvent('doubt', { id: 'd1' });
          finish = () => {
            onEvent('done', { id: 'd1' });
            resolve();
          };
        })
    );
    const player = fakePlayer('playing');
    const { result } = renderHook(() => useDoubtSession(player), { wrapper });
    let asking;
    act(() => {
      asking = result.current.ask({ question: 'Where is the image?' });
    });

    act(() => result.current.say('why is it upside down?'));
    expect(result.current.session.pending).toBe('why is it upside down?');
    expect(doubtService.streamTurn).not.toHaveBeenCalled();

    await act(async () => {
      finish();
      await asking;
      await flush();
    });

    expect(doubtService.streamTurn).toHaveBeenCalledTimes(1);
    expect(doubtService.streamTurn).toHaveBeenCalledWith(
      'd1',
      { question: 'why is it upside down?', keep: 3 },
      expect.anything()
    );
    expect(player.cut).toHaveBeenCalledWith(3);
    expect(result.current.session.pending).toBeNull();
  });

  it('say() mid-explanation cuts at the end of the step', async () => {
    const player = fakePlayer('playing');
    const { result } = await askedDoubt(player);

    await act(async () => result.current.say('why?'));

    expect(player.cut).toHaveBeenCalledWith(3);
    expect(player.extend).toHaveBeenCalled();
    expect(doubtService.streamTurn).toHaveBeenCalledWith(
      'd1',
      { question: 'why?', keep: 3 },
      expect.anything()
    );
  });

  it('say() during the last step sends keep equal to the turn length', async () => {
    const player = fakePlayer('playing');
    player.stepEnd.mockReturnValue(6);
    const { result } = await askedDoubt(player);

    await act(async () => result.current.say('and then?'));

    expect(doubtService.streamTurn).toHaveBeenCalledWith(
      'd1',
      { question: 'and then?', keep: 6 },
      expect.anything()
    );
  });

  it('say() on a finished board sends a plain follow-up', async () => {
    const player = fakePlayer('finished');
    const { result } = await askedDoubt(player);

    await act(async () => result.current.say('what about a concave lens?'));

    expect(player.cut).not.toHaveBeenCalled();
    expect(doubtService.streamTurn).toHaveBeenCalledWith(
      'd1',
      { question: 'what about a concave lens?' },
      expect.anything()
    );
  });
});

describe('useDoubtSession: answers', () => {
  it('a correct answer writes a tick and moves on', async () => {
    const player = fakePlayer('asking');
    player.ask = QUESTION;
    const outcome = { correct: true, attempt: 1, final: true, expected: null };
    doubtService.answer.mockResolvedValue(outcome);
    const { result } = await askedDoubt(player);

    await act(async () => result.current.answer('12'));

    expect(doubtService.answer).toHaveBeenCalledWith('d1', { ask: 'q1', answer: '12' });
    expect(player.answerAsk).toHaveBeenCalledWith({
      text: '12',
      correct: true,
      say: 'Correct! Well done.',
      release: true,
    });
    expect(doubtService.streamTurn).not.toHaveBeenCalled();
    expect(result.current.session.feedback).toEqual({ kind: 'correct', expected: null });
  });

  it('two wrong answers start a check turn', async () => {
    const player = fakePlayer('asking');
    player.ask = QUESTION;
    const { result } = await askedDoubt(player);

    const first = { correct: false, attempt: 1, final: false, expected: null };
    doubtService.answer.mockResolvedValue(first);
    await act(async () => result.current.answer('14'));
    expect(player.answerAsk).toHaveBeenLastCalledWith({
      text: '14',
      correct: false,
      say: 'Not quite. Have another go.',
      release: false,
    });
    expect(doubtService.streamTurn).not.toHaveBeenCalled();

    const second = { correct: false, attempt: 2, final: true, expected: '12 cm' };
    doubtService.answer.mockResolvedValue(second);
    await act(async () => result.current.answer('15'));

    expect(player.answerAsk).toHaveBeenLastCalledWith({
      text: '15',
      correct: false,
      say: null,
      release: true,
    });
    expect(player.cut).toHaveBeenCalledWith(7);
    expect(doubtService.streamTurn).toHaveBeenCalledWith(
      'd1',
      { mode: 'check', ask: 'q1', keep: 7 },
      expect.anything()
    );
    expect(result.current.session.feedback).toEqual({ kind: 'final', expected: '12 cm' });
  });

  it('an unreadable answer keeps the question open', async () => {
    const player = fakePlayer('asking');
    player.ask = QUESTION;
    doubtService.answer.mockRejectedValue(new Error('Check your answer and try again.'));
    const { result } = await askedDoubt(player);

    await act(async () => result.current.answer('abc'));

    expect(player.answerAsk).not.toHaveBeenCalled();
    expect(result.current.session.feedback).toEqual({
      kind: 'unreadable',
      message: 'Check your answer and try again.',
    });
    expect(result.current.session.checking).toBe(false);
  });

  it('skipping a question with nothing after it asks for the solution', async () => {
    const player = fakePlayer('asking');
    player.ask = QUESTION;
    player.next = 6; // the question was the last thing on the board
    const { result } = await askedDoubt(player);

    await act(async () => result.current.skip());

    expect(player.skipAsk).toHaveBeenCalled();
    expect(doubtService.streamTurn).toHaveBeenCalledWith(
      'd1',
      { mode: 'check', ask: 'q1', keep: 6 },
      expect.anything()
    );
  });
});

it('tryOne() streams a practice turn', async () => {
  const player = fakePlayer('finished');
  const { result } = await askedDoubt(player);

  await act(async () => result.current.tryOne());

  expect(player.extend).toHaveBeenCalled();
  expect(doubtService.streamTurn).toHaveBeenCalledWith(
    'd1',
    { mode: 'practice' },
    expect.anything()
  );
});


describe('useDoubtSession: review fixes', () => {
  const caption = (text) => ({ type: 'caption', text });
  const write = (text) => ({ type: 'write', text });
  const TURN = [caption('c1'), write('w1'), caption('c2'), write('w2')];

  function streamingActions(actions) {
    return (bodyOrId, maybeBody, maybeOptions) => {
      const { onEvent } = maybeOptions ?? maybeBody;
      onEvent('doubt', { id: 'd1' });
      actions.forEach((action) => onEvent('action', action));
      onEvent('done', { id: 'd1' });
      return Promise.resolve();
    };
  }

  it('talking while the board replays an earlier turn sends a plain follow-up', async () => {
    const player = attachFakeCanvas(new BoardPlayer());
    doubtService.stream.mockImplementation(streamingActions(TURN));
    doubtService.streamTurn.mockImplementation(streamingActions(TURN));
    const { result } = renderHook(() => useDoubtSession(player), { wrapper });
    await act(async () => result.current.ask({ question: 'Q' }));
    drain(player);
    await act(async () => result.current.say('and then?'));
    drain(player);
    expect(player.actions).toHaveLength(8);

    player.replay();
    player._advance(0); // the playhead is back in the first turn
    expect(player.next).toBeLessThan(player.turnOffset);
    await act(async () => result.current.say('wait, why?'));

    expect(doubtService.streamTurn).toHaveBeenLastCalledWith(
      'd1',
      { question: 'wait, why?' },
      expect.anything()
    );
    expect(player.actions).toHaveLength(12);
  });

  it('an answer given while the AI is still writing is sent after it finishes', async () => {
    let finish;
    doubtService.stream.mockImplementation(
      (body, { onEvent }) =>
        new Promise((resolve) => {
          onEvent('doubt', { id: 'd1' });
          finish = () => {
            onEvent('done', { id: 'd1' });
            resolve();
          };
        })
    );
    const outcome = { correct: true, attempt: 1, final: true, expected: null };
    doubtService.answer.mockResolvedValue(outcome);
    const player = fakePlayer('asking');
    player.ask = QUESTION;
    const { result } = renderHook(() => useDoubtSession(player), { wrapper });
    let asking;
    act(() => {
      asking = result.current.ask({ question: 'Q' });
    });

    await act(async () => result.current.answer('12'));
    expect(doubtService.answer).not.toHaveBeenCalled();
    expect(result.current.session.checking).toBe(true);

    await act(async () => {
      finish();
      await asking;
      await flush();
    });
    expect(doubtService.answer).toHaveBeenCalledTimes(1);
    expect(player.answerAsk).toHaveBeenCalledWith(expect.objectContaining({ text: '12' }));
  });

  it('a refused turn gives the board back what it cut', async () => {
    const player = fakePlayer('playing');
    player.cut.mockReturnValue(['rest of the step']);
    player.restore = vi.fn();
    const { result } = await askedDoubt(player);
    doubtService.streamTurn.mockRejectedValue(new Error('Too many requests'));

    await act(async () => result.current.say('why?'));

    expect(player.restore).toHaveBeenCalledWith(['rest of the step']);
    expect(result.current.session.phase).toBe('error');
  });

  it('two messages sent while the AI is writing both go out', async () => {
    let finish;
    doubtService.stream.mockImplementation(
      (body, { onEvent }) =>
        new Promise((resolve) => {
          onEvent('doubt', { id: 'd1' });
          finish = () => {
            onEvent('done', { id: 'd1' });
            resolve();
          };
        })
    );
    const player = fakePlayer('playing');
    const { result } = renderHook(() => useDoubtSession(player), { wrapper });
    let asking;
    act(() => {
      asking = result.current.ask({ question: 'Q' });
    });

    act(() => result.current.say('why is it inverted?'));
    act(() => result.current.say('and smaller?'));
    expect(result.current.session.pending).toBe('why is it inverted?\nand smaller?');

    await act(async () => {
      finish();
      await asking;
      await flush();
    });
    expect(doubtService.streamTurn).toHaveBeenCalledTimes(1);
    expect(doubtService.streamTurn.mock.calls[0][1].question).toBe(
      'why is it inverted?\nand smaller?'
    );
  });
});
