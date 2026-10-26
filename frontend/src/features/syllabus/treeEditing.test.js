import {
  addChapter,
  addTopic,
  fromServer,
  moveChapter,
  moveTopic,
  removeChapter,
  removeTopic,
  renameChapter,
  renameTopic,
  toggleDone,
  toPayload,
} from './treeEditing';

const SERVER = [
  {
    id: 'c1',
    title: 'Matter',
    topics: [
      { id: 't1', title: 'States', done: false },
      { id: 't2', title: 'Evaporation', done: true },
    ],
  },
  { id: 'c2', title: 'Force', topics: [{ id: 't3', title: 'Inertia', done: false }] },
];

describe('treeEditing', () => {
  it('gives every row a stable key and keeps server ids', () => {
    const tree = fromServer(SERVER);
    expect(tree.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(new Set(tree.flatMap((c) => [c.key, ...c.topics.map((t) => t.key)])).size).toBe(5);
  });

  it('moves are clamped at the ends', () => {
    const tree = fromServer(SERVER);
    expect(moveChapter(tree, 0, -1)).toBe(tree);
    expect(moveChapter(tree, 1, 1)).toBe(tree);
    expect(moveChapter(tree, 0, 1).map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(moveTopic(tree, 0, 1, 1)).toBe(tree);
    expect(moveTopic(tree, 0, 1, -1)[0].topics.map((t) => t.id)).toEqual(['t2', 't1']);
  });

  it('edits without touching the original', () => {
    const tree = fromServer(SERVER);
    let next = renameChapter(tree, 1, 'Force and motion');
    next = renameTopic(next, 0, 0, 'States of matter');
    next = toggleDone(next, 1, 0);
    next = removeTopic(next, 0, 1);
    expect(tree[0].topics).toHaveLength(2);
    expect(next[1].title).toBe('Force and motion');
    expect(next[0].topics.map((t) => t.title)).toEqual(['States of matter']);
    expect(next[1].topics[0].done).toBe(true);
    expect(removeChapter(next, 0).map((c) => c.id)).toEqual(['c2']);
  });

  it('new rows have no id', () => {
    let tree = addChapter(fromServer(SERVER));
    tree = addTopic(tree, 2);
    expect(tree[2].id).toBeUndefined();
    expect(tree[2].topics[0].id).toBeUndefined();
    expect(tree[2].topics[0].done).toBe(false);
  });

  it('toPayload keeps ids and drops empty titles', () => {
    let tree = addChapter(fromServer(SERVER));
    tree = renameChapter(tree, 2, '  Gravitation  ');
    tree = addTopic(tree, 2);
    tree = addTopic(tree, 2);
    tree = renameTopic(tree, 2, 1, 'Free fall');
    tree = addChapter(tree);

    expect(toPayload(tree)).toEqual([
      {
        id: 'c1',
        title: 'Matter',
        topics: [
          { id: 't1', title: 'States', done: false },
          { id: 't2', title: 'Evaporation', done: true },
        ],
      },
      { id: 'c2', title: 'Force', topics: [{ id: 't3', title: 'Inertia', done: false }] },
      { title: 'Gravitation', topics: [{ title: 'Free fall', done: false }] },
    ]);
  });
});
