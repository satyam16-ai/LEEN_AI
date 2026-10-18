import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PageStrip } from './PageStrip';

const pages = [
  { title: 'What is a prime?', thumb: 'data:image/png;base64,AAA' },
  { title: 'Why is 1 not prime?', thumb: null },
];

describe('PageStrip', () => {
  it('shows a button per earlier page', () => {
    render(<PageStrip pages={pages} current="Another question" />);
    expect(screen.getAllByRole('button', { name: /page \d/i })).toHaveLength(2);
    expect(screen.getByText('Why is 1 not prime?')).toBeInTheDocument();
  });

  it('opens a page in a dialog', async () => {
    const user = userEvent.setup();
    render(<PageStrip pages={pages} current="Another question" />);

    await user.click(screen.getByRole('button', { name: /page 1/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('What is a prime?');
    expect(dialog.querySelector('img')).toHaveAttribute('src', pages[0].thumb);
  });

  it('renders nothing without earlier pages', () => {
    const { container } = render(<PageStrip pages={[]} current="Only page" />);
    expect(container).toBeEmptyDOMElement();
  });
});
