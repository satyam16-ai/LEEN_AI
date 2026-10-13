import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { SubjectPicker } from './SubjectPicker';

function Harness({ initial = [], grade = 9 }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SubjectPicker value={value} onChange={setValue} grade={grade} />
      <output data-testid="value">{value.join('|')}</output>
    </>
  );
}

const value = () => screen.getByTestId('value').textContent;

describe('SubjectPicker', () => {
  it('suggests subjects for the selected class and toggles them', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Science' }));
    await user.click(screen.getByRole('button', { name: 'Mathematics' }));
    expect(value()).toBe('Science|Mathematics');

    await user.click(screen.getByRole('button', { name: 'Science' }));
    expect(value()).toBe('Mathematics');
  });

  it('shows senior-secondary subjects for class 11+', () => {
    render(<Harness grade={12} />);

    expect(screen.getByRole('button', { name: 'Physics' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Social Science' })).not.toBeInTheDocument();
  });

  it('adds custom subjects once, ignoring case duplicates', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Add another subject');

    await user.type(input, 'Robotics{Enter}');
    await user.type(input, 'robotics{Enter}');

    expect(value()).toBe('Robotics');
    await user.click(screen.getByRole('button', { name: 'Remove Robotics' }));
    expect(value()).toBe('');
  });
});
