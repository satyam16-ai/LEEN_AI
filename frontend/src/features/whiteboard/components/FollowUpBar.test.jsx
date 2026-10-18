import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FollowUpBar } from './FollowUpBar';

function setup(props = {}) {
  const handlers = { onFollowUp: vi.fn(), onAnotherWay: vi.fn() };
  render(<FollowUpBar {...handlers} {...props} />);
  return { user: userEvent.setup(), ...handlers };
}

describe('FollowUpBar', () => {
  it('sends a trimmed follow-up question and clears the box', async () => {
    const { user, onFollowUp } = setup();
    const box = screen.getByRole('textbox', { name: /follow-up/i });

    await user.type(box, '  Why is it 2xy?  ');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(onFollowUp).toHaveBeenCalledWith('Why is it 2xy?');
    expect(box).toHaveValue('');
  });

  it('cannot send an empty question', async () => {
    const { user, onFollowUp } = setup();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /follow-up/i }), '   {Enter}');
    expect(onFollowUp).not.toHaveBeenCalled();
  });

  it('asks for another explanation', async () => {
    const { user, onAnotherWay } = setup();
    await user.click(screen.getByRole('button', { name: /explain another way/i }));
    expect(onAnotherWay).toHaveBeenCalledTimes(1);
  });

  it('is disabled while the board is busy', () => {
    setup({ busy: true });
    expect(screen.getByRole('textbox', { name: /follow-up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /explain another way/i })).toBeDisabled();
  });

  it('says when the board is full', () => {
    setup({ full: true });
    expect(screen.getByText(/this board is full/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
