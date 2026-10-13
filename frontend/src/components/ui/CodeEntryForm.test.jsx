import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CodeEntryForm } from './CodeEntryForm';

function setup(onSubmit = vi.fn()) {
  render(
    <CodeEntryForm
      label="Child's link code"
      placeholder="XXXX-XXXX"
      length={8}
      groupSize={4}
      submitLabel="Link child"
      onSubmit={onSubmit}
    />
  );
  return { onSubmit, input: screen.getByLabelText("Child's link code") };
}

describe('CodeEntryForm', () => {
  it('uppercases, strips separators and groups the code', async () => {
    const user = userEvent.setup();
    const { input } = setup();

    await user.type(input, 'ab cd-ef9h2');

    expect(input).toHaveValue('ABCD-EF9H');
  });

  it('asks for the full code before submitting', async () => {
    const user = userEvent.setup();
    const { input, onSubmit } = setup();

    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'Link child' }));

    expect(screen.getByText('Enter the full 8-character code')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the formatted code and clears the field', async () => {
    const user = userEvent.setup();
    const { input, onSubmit } = setup(vi.fn().mockResolvedValue());

    await user.type(input, 'abcdefgh');
    await user.click(screen.getByRole('button', { name: 'Link child' }));

    expect(onSubmit).toHaveBeenCalledWith('ABCD-EFGH');
    expect(input).toHaveValue('');
  });

  it('shows the error thrown by onSubmit', async () => {
    const user = userEvent.setup();
    const { input } = setup(vi.fn().mockRejectedValue(new Error('That code has expired')));

    await user.type(input, 'abcdefgh');
    await user.click(screen.getByRole('button', { name: 'Link child' }));

    expect(await screen.findByText('That code has expired')).toBeInTheDocument();
    expect(input).toHaveValue('ABCD-EFGH');
  });
});
