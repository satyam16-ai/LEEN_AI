import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import { DoubtComposer } from './DoubtComposer';
import { DoubtSuggestions } from './DoubtSuggestions';

function setup(props = {}) {
  const onAsk = vi.fn();
  const onStop = vi.fn();
  render(
    <DoubtComposer subjects={['Mathematics', 'Science']} onAsk={onAsk} onStop={onStop} {...props} />
  );
  return { onAsk, onStop, input: screen.getByLabelText("What's your doubt?") };
}

describe('DoubtComposer', () => {
  it('asks with Enter and sends the chosen subject', async () => {
    const user = userEvent.setup();
    const { onAsk, input } = setup();

    await user.selectOptions(screen.getByLabelText('Subject'), 'Mathematics');
    await user.type(input, '  What is a prime number?{Enter}');

    expect(onAsk).toHaveBeenCalledWith({
      question: 'What is a prime number?',
      subject: 'Mathematics',
    });
    expect(input).toHaveValue('');
  });

  it('keeps Shift+Enter for new lines and rejects a too-short doubt', async () => {
    const user = userEvent.setup();
    const { onAsk, input } = setup();

    await user.type(input, 'hi{Shift>}{Enter}{/Shift}');
    expect(input).toHaveValue('hi\n');

    await user.click(screen.getByRole('button', { name: /Explain/ }));
    expect(await screen.findByText('Type your doubt (at least 3 characters)')).toBeInTheDocument();
    expect(onAsk).not.toHaveBeenCalled();
  });

  it('shows Stop while an explanation is streaming', async () => {
    const user = userEvent.setup();
    const { onStop } = setup({ busy: true });

    expect(screen.queryByRole('button', { name: /Explain/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalled();
  });

  it('does not start a new explanation when Stop ends the stream mid-click', async () => {
    const user = userEvent.setup();
    const onAsk = vi.fn();
    function Harness() {
      const [busy, setBusy] = useState(true);
      // The stream ends (and the button swaps back) before the click's default action runs.
      const stop = () => flushSync(() => setBusy(false));
      return <DoubtComposer busy={busy} onAsk={onAsk} onStop={stop} />;
    }
    render(<Harness />);
    await user.type(screen.getByLabelText("What's your doubt?"), 'What is a prime number?');

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(await screen.findByRole('button', { name: /Explain/ })).toBeInTheDocument();
    expect(onAsk).not.toHaveBeenCalled();
  });
});

describe('DoubtSuggestions', () => {
  it('asks a suggested doubt in one click', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<DoubtSuggestions onPick={onPick} />);

    await user.click(screen.getByRole('button', { name: /Why is \(x\+y\)/ }));

    expect(onPick).toHaveBeenCalledWith('Why is (x+y)^2 = x^2 + 2xy + y^2?');
  });
});

describe('DoubtComposer: photos', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });

  const photo = () => new File(['jpeg'], 'question.jpg', { type: 'image/jpeg' });

  it('asks with only a photo', async () => {
    const user = userEvent.setup();
    const { onAsk } = setup();
    const file = photo();

    await user.upload(screen.getByLabelText('Add a photo of the question'), file);
    expect(screen.getByRole('img', { name: 'Your photo' })).toHaveAttribute('src', 'blob:photo');
    await user.click(screen.getByRole('button', { name: /Explain/ }));

    expect(onAsk).toHaveBeenCalledWith({ question: '', subject: null, photo: file });
    expect(screen.queryByRole('img', { name: 'Your photo' })).not.toBeInTheDocument();
  });

  it('removing the photo brings back the question requirement', async () => {
    const user = userEvent.setup();
    const { onAsk } = setup();

    await user.upload(screen.getByLabelText('Add a photo of the question'), photo());
    await user.click(screen.getByRole('button', { name: 'Remove photo' }));
    await user.click(screen.getByRole('button', { name: /Explain/ }));

    expect(onAsk).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 3 characters/)).toBeInTheDocument();
  });
});
