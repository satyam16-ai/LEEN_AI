import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TopicTreeEditor } from './TopicTreeEditor';

const CHAPTERS = [
  {
    id: 'c1',
    title: 'Matter',
    topics: [
      { id: 't1', title: 'States', done: false },
      { id: 't2', title: 'Evaporation', done: false },
    ],
  },
];

describe('TopicTreeEditor', () => {
  it('saves renames, moves, new topics and done marks', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<TopicTreeEditor chapters={CHAPTERS} onSave={onSave} />);

    const chapterTitle = screen.getByRole('textbox', { name: 'Chapter 1 title' });
    await user.clear(chapterTitle);
    await user.type(chapterTitle, 'Matter around us');
    await user.click(screen.getByRole('button', { name: 'Move Evaporation up' }));
    await user.click(screen.getByRole('checkbox', { name: 'Done: States' }));
    await user.click(screen.getByRole('button', { name: 'Add topic to Matter around us' }));
    await user.type(screen.getByRole('textbox', { name: 'Topic 3 of chapter 1' }), 'Diffusion');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      chapters: [
        {
          id: 'c1',
          title: 'Matter around us',
          topics: [
            { id: 't2', title: 'Evaporation', done: false },
            { id: 't1', title: 'States', done: true },
            { title: 'Diffusion', done: false },
          ],
        },
      ],
      confirm: false,
    });
  });

  it('confirm sends confirm: true and deleting removes rows', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<TopicTreeEditor chapters={CHAPTERS} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Delete topic States' }));
    await user.click(screen.getByRole('button', { name: 'Confirm syllabus' }));

    expect(onSave).toHaveBeenCalledWith({
      chapters: [
        { id: 'c1', title: 'Matter', topics: [{ id: 't2', title: 'Evaporation', done: false }] },
      ],
      confirm: true,
    });
  });

  it('starts an empty tree with one blank chapter', () => {
    render(<TopicTreeEditor chapters={[]} onSave={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Chapter 1 title' })).toHaveValue('');
  });
});
