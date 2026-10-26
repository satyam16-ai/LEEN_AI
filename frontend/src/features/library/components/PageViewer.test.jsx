import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fetchBlob } from '@/utils/blobUrl';

import { PageViewer } from './PageViewer';

vi.mock('@/utils/blobUrl', () => ({ fetchBlob: vi.fn() }));

describe('PageViewer', () => {
  beforeEach(() => {
    URL.revokeObjectURL = vi.fn();
  });

  it('shows an image page', async () => {
    fetchBlob.mockResolvedValue({ url: 'blob:page-1', type: 'image/jpeg' });
    render(<PageViewer source={{ doc: 'doc-1', page: 1, title: 'Force' }} onClose={() => {}} />);

    const image = await screen.findByRole('img', { name: 'Force, page 1' });
    expect(image).toHaveAttribute('src', 'blob:page-1');
    expect(fetchBlob).toHaveBeenCalledWith('/student/documents/doc-1/file');
  });

  it('opens a PDF at the cited page', async () => {
    fetchBlob.mockResolvedValue({ url: 'blob:book', type: 'application/pdf' });
    render(<PageViewer source={{ doc: 'doc-2', page: 3, title: 'Motion' }} onClose={() => {}} />);

    const frame = await screen.findByTitle('Motion, page 3');
    expect(frame).toHaveAttribute('src', 'blob:book#page=3');
    // Phone browsers often can't show a PDF in a frame, so it can open on its own too.
    const open = screen.getByRole('link', { name: /open the pdf/i });
    expect(open).toHaveAttribute('href', 'blob:book#page=3');
    expect(open).toHaveAttribute('target', '_blank');
  });

  it('never shows a freed file when the same page opens again', async () => {
    fetchBlob.mockResolvedValue({ url: 'blob:first', type: 'image/jpeg' });
    const source = { doc: 'doc-1', page: 1, title: 'Force' };
    const { rerender } = render(<PageViewer source={source} onClose={() => {}} />);
    await screen.findByRole('img', { name: 'Force, page 1' });

    rerender(<PageViewer source={null} onClose={() => {}} />);
    fetchBlob.mockReturnValue(new Promise(() => {}));
    rerender(<PageViewer source={{ ...source }} onClose={() => {}} />);

    expect(screen.queryByRole('img', { name: 'Force, page 1' })).not.toBeInTheDocument();
  });

  it('closes and frees the file', async () => {
    fetchBlob.mockResolvedValue({ url: 'blob:page-1', type: 'image/jpeg' });
    const onClose = vi.fn();
    const { rerender } = render(
      <PageViewer source={{ doc: 'doc-1', page: 1, title: 'Force' }} onClose={onClose} />
    );
    await screen.findByRole('img', { name: 'Force, page 1' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    rerender(<PageViewer source={null} onClose={onClose} />);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:page-1'));
  });

  it('says so when the page is gone', async () => {
    fetchBlob.mockRejectedValue(new Error('404'));
    render(<PageViewer source={{ doc: 'gone', page: 1, title: 'Force' }} onClose={() => {}} />);

    expect(await screen.findByText(/couldn't open this page/i)).toBeInTheDocument();
  });
});
