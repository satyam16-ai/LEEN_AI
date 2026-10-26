import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { syllabusService } from '@/services/syllabusService';
import { createTestQueryClient } from '@/test/renderWithProviders';

import { useSyllabus } from './useSyllabus';

vi.mock('@/services/syllabusService', () => ({
  syllabusService: { list: vi.fn(), get: vi.fn(), upload: vi.fn(), save: vi.fn() },
}));

const tree = (status) => ({ subject: 'Science', status, error: null, chapters: [] });

describe('useSyllabus', () => {
  afterEach(() => vi.useRealTimers());

  it('polls while the contents page is being read and stops at the draft', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    syllabusService.get.mockResolvedValueOnce(tree('reading')).mockResolvedValue(tree('draft'));
    const client = createTestQueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSyllabus('Science'), { wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe('reading'));

    await act(() => vi.advanceTimersByTimeAsync(2100));
    await waitFor(() => expect(result.current.data?.status).toBe('draft'));
    await act(() => vi.advanceTimersByTimeAsync(6000));

    expect(syllabusService.get).toHaveBeenCalledTimes(2);
    expect(syllabusService.get).toHaveBeenCalledWith('Science');
  });
});
