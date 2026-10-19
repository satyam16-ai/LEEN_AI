import { boardStatus } from './status';

it('boardStatus shows Your turn while asking', () => {
  expect(boardStatus('done', 'asking')).toMatchObject({ label: 'Your turn' });
});
