import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';

import { useSpeechInput } from '@/features/canvas';

import { TalkBar } from './TalkBar';

vi.mock('@/features/canvas', () => ({ useSpeechInput: vi.fn() }));

let speech;
let heard;

beforeEach(() => {
  speech = {
    supported: true,
    listening: false,
    interim: '',
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
  };
  useSpeechInput.mockImplementation(({ onFinal }) => {
    heard = onFinal;
    return speech;
  });
});

function setup(props = {}) {
  const handlers = {
    onSay: vi.fn(),
    onAnswer: vi.fn(),
    onSkip: vi.fn(),
    onAnotherWay: vi.fn(),
    onTryOne: vi.fn(),
  };
  render(<TalkBar {...handlers} {...props} />);
  return { user: userEvent.setup(), ...handlers };
}

describe('TalkBar: talking', () => {
  it('sends a typed message', async () => {
    const { user, onSay } = setup({ playing: true });
    const box = screen.getByRole('textbox', { name: /say or type/i });
    expect(box).toHaveAttribute('placeholder', expect.stringMatching(/after this step/));

    await user.type(box, '  why is it upside down?  {Enter}');

    expect(onSay).toHaveBeenCalledWith('why is it upside down?');
    expect(box).toHaveValue('');
  });

  it('shows a queued message', () => {
    setup({ playing: true, pending: 'why?' });
    expect(screen.getByText(/LEEN will answer after this step/)).toHaveTextContent('You: why?');
  });

  it('offers another way and Now you try once the board is finished', async () => {
    const { user, onAnotherWay, onTryOne } = setup({ playing: false });
    await user.click(screen.getByRole('button', { name: /explain another way/i }));
    await user.click(screen.getByRole('button', { name: /now you try/i }));
    expect(onAnotherWay).toHaveBeenCalled();
    expect(onTryOne).toHaveBeenCalled();
  });

  it('hides them while the board is still explaining', () => {
    setup({ playing: true });
    expect(screen.queryByRole('button', { name: /now you try/i })).toBeNull();
  });

  it('full board shows the start-a-new-doubt note', () => {
    setup({ full: true });
    expect(screen.getByText(/start a new doubt/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('TalkBar: answering', () => {
  it('answers a choice question with its letter', async () => {
    const ask = { id: 'q1', kind: 'choice', options: ['4', '8', '16'] };
    const { user, onAnswer } = setup({ ask });

    await user.click(screen.getByRole('button', { name: 'B. 8' }));

    expect(onAnswer).toHaveBeenCalledWith('B');
  });

  it('number answers show the unit and need a value', async () => {
    const { user, onAnswer } = setup({ ask: { id: 'q1', kind: 'number', unit: 'cm' } });
    const check = screen.getByRole('button', { name: /check/i });

    expect(screen.getByText('cm')).toBeInTheDocument();
    expect(check).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /your answer/i }), '12');
    await user.click(check);

    expect(onAnswer).toHaveBeenCalledWith('12');
  });

  it('hint is revealed on request, and Skip moves on', async () => {
    const ask = { id: 'q1', kind: 'expr', hint: 'Expand (x+1)(x+1)' };
    const { user, onSkip } = setup({ ask });

    expect(screen.queryByText('Expand (x+1)(x+1)')).toBeNull();
    await user.click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByText('Expand (x+1)(x+1)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /skip/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('shows how the last answer went', () => {
    setup({ ask: { id: 'q1', kind: 'number' }, feedback: { kind: 'wrong' } });
    expect(screen.getByText('Not quite. Have another go.')).toBeInTheDocument();
  });
});

describe('TalkBar: speaking', () => {
  it('mic is hidden when speech is unsupported', () => {
    speech.supported = false;
    setup({ playing: true });
    expect(screen.queryByRole('button', { name: /speak/i })).toBeNull();
  });

  it('a spoken message is sent, a spoken answer fills the box', async () => {
    const { onSay } = setup({ playing: true });
    act(() => heard('why is it upside down'));
    expect(onSay).toHaveBeenCalledWith('why is it upside down');

    const props = { ask: { id: 'q2', kind: 'text' }, onSay, onAnswer: vi.fn(), onSkip: vi.fn() };
    render(<TalkBar {...props} />);
    act(() => heard('light slows down in glass'));
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveValue(
      'light slows down in glass'
    );
    expect(onSay).toHaveBeenCalledTimes(1);
  });

  it('turns narration down while listening', () => {
    speech.listening = true;
    const onListening = vi.fn();
    setup({ playing: true, onListening });
    expect(onListening).toHaveBeenCalledWith(true);
  });
});


describe('TalkBar: review fixes', () => {
  it('a spoken word too short to be a message is ignored', () => {
    const { onSay } = setup({ playing: true });
    act(() => heard('ok'));
    expect(onSay).not.toHaveBeenCalled();
  });

  it('a new question with the same id starts with its hint hidden', async () => {
    const handlers = { onSay: vi.fn(), onAnswer: vi.fn(), onSkip: vi.fn() };
    const first = { id: 'q1', kind: 'number', hint: 'Multiply' };
    const { rerender } = render(<TalkBar {...handlers} ask={first} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByText('Multiply')).toBeInTheDocument();

    rerender(<TalkBar {...handlers} ask={{ id: 'q1', kind: 'number', hint: 'Add them' }} />);

    expect(screen.queryByText('Add them')).toBeNull();
  });
});


describe('TalkBar: deferred fixes', () => {
  it('an unsent message is put back in the box', () => {
    setup({ playing: false, unsent: 'why is it inverted?' });
    const box = screen.getByRole('textbox', { name: /say or type/i });
    expect(box).toHaveValue('why is it inverted?');
  });

  it('a marked written answer points to the board', () => {
    setup({ playing: false, feedback: { kind: 'marked' } });
    expect(screen.getByText('See the board for what to fix.')).toBeInTheDocument();
  });

  it('the hint shows itself after a wrong answer', () => {
    const ask = { id: 'q1', kind: 'number', hint: 'Multiply them' };
    setup({ ask, feedback: { kind: 'wrong' } });
    expect(screen.getByText('Multiply them')).toBeInTheDocument();
  });

  it('closing the bar while listening turns narration back up', () => {
    speech.listening = true;
    const onListening = vi.fn();
    const { unmount } = render(
      <TalkBar playing onListening={onListening} onSay={vi.fn()} onAnswer={vi.fn()} />
    );
    unmount();
    expect(onListening).toHaveBeenLastCalledWith(false);
  });
});
