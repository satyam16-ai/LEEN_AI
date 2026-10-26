import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CiteLayer } from './CiteLayer';

const CITE = {
  key: 'cite-3',
  x: 160,
  y: 450,
  w: 320,
  h: 45,
  doc: 'doc-1',
  page: 112,
  title: 'Force',
};

describe('CiteLayer', () => {
  it('puts a button over each chip, in board percentages', () => {
    render(<CiteLayer cites={[CITE]} onOpen={() => {}} />);

    const button = screen.getByRole('button', { name: 'Open Force, page 112' });
    expect(button.style.left).toBe('10%');
    expect(button.style.top).toBe('50%');
    expect(button.style.width).toBe('20%');
    expect(button.style.height).toBe('5%');
  });

  it('opens the page', async () => {
    const onOpen = vi.fn();
    render(<CiteLayer cites={[CITE]} onOpen={onOpen} />);

    await userEvent.setup().click(screen.getByRole('button', { name: /Open Force/ }));

    expect(onOpen).toHaveBeenCalledWith({ doc: 'doc-1', page: 112, title: 'Force' });
  });

  it('renders nothing without chips', () => {
    const { container } = render(<CiteLayer cites={[]} onOpen={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
