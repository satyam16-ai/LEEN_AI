import { onlineManager } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { documentService } from '@/services/documentService';
import { syllabusService } from '@/services/syllabusService';
import { renderRoutes } from '@/test/renderWithProviders';

import { StudentSyllabusPage } from './StudentSyllabusPage';

vi.mock('@/services/syllabusService', () => ({
  syllabusService: { list: vi.fn(), get: vi.fn(), upload: vi.fn(), save: vi.fn() },
}));
vi.mock('@/services/documentService', () => ({
  documentService: { list: vi.fn(), upload: vi.fn(), remove: vi.fn(), filePath: vi.fn() },
}));

const SUBJECTS = [
  { subject: 'Science', status: 'empty', chapters: 0, topics: 0, done: 0 },
  { subject: 'Maths', status: 'confirmed', chapters: 2, topics: 9, done: 3 },
];
const routes = [{ path: '/student/syllabus/:subject?', element: <StudentSyllabusPage /> }];

describe('StudentSyllabusPage', () => {
  beforeEach(() => {
    syllabusService.list.mockResolvedValue(SUBJECTS);
    syllabusService.get.mockImplementation(async (subject) =>
      subject === 'Maths'
        ? {
            subject,
            status: 'confirmed',
            error: null,
            chapters: [
              {
                id: 'c1',
                title: 'Polynomials',
                topics: [{ id: 't1', title: 'Zeroes', done: true }],
              },
            ],
          }
        : { subject, status: 'empty', error: null, chapters: [] }
    );
    documentService.list.mockResolvedValue([]);
  });

  it('lists the profile subjects and opens the first', async () => {
    renderRoutes(routes, { path: '/student/syllabus' });

    expect(await screen.findByRole('link', { name: /Science/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Maths/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Upload contents page' })).toBeInTheDocument();
    expect(syllabusService.get).toHaveBeenCalledWith('Science');
  });

  it('uploads the contents page for the subject', async () => {
    const user = userEvent.setup();
    syllabusService.upload.mockResolvedValue({
      subject: 'Science',
      status: 'reading',
      error: null,
      chapters: [],
    });
    renderRoutes(routes, { path: '/student/syllabus/Science' });

    const file = new File(['%PDF-1.4'], 'contents.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('Contents page photos or PDF'), file);

    expect(syllabusService.upload).toHaveBeenCalledWith('Science', [file]);
    expect(await screen.findByText(/Reading your contents page/)).toBeInTheDocument();
  });

  it('shows a confirmed tree for editing', async () => {
    renderRoutes(routes, { path: '/student/syllabus/Maths' });

    const chapter = await screen.findByRole('textbox', { name: 'Chapter 1 title' });
    expect(chapter).toHaveValue('Polynomials');
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Done: Zeroes' })).toBeChecked();
  });
});

describe('StudentSyllabusPage: editing', () => {
  beforeEach(() => {
    syllabusService.list.mockResolvedValue(SUBJECTS);
    syllabusService.get.mockResolvedValue({
      subject: 'Maths',
      status: 'confirmed',
      error: null,
      chapters: [{ id: 'c1', title: 'Polynomials', topics: [] }],
    });
    documentService.list.mockResolvedValue([]);
  });

  it('keeps unsaved edits when the phone reconnects', async () => {
    const user = userEvent.setup();
    renderRoutes(routes, { path: '/student/syllabus/Maths' });
    const chapter = await screen.findByRole('textbox', { name: 'Chapter 1 title' });
    await user.type(chapter, ' and zeroes');

    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByRole('textbox', { name: 'Chapter 1 title' })).toHaveValue(
      'Polynomials and zeroes'
    );
    expect(syllabusService.get).toHaveBeenCalledTimes(1);
  });
});
