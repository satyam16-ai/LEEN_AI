/**
 * Pure edits of a syllabus tree as the editor holds it: chapters with topics, each with a
 * local `key` for React and the server `id` when the row already exists (new rows have none,
 * so the server inserts them). Every edit returns a new tree.
 */
let nextKey = 0;
const newKey = () => `row-${(nextKey += 1)}`;

export function fromServer(chapters = []) {
  return chapters.map((chapter) => ({
    key: newKey(),
    id: chapter.id,
    title: chapter.title,
    topics: chapter.topics.map((topic) => ({
      key: newKey(),
      id: topic.id,
      title: topic.title,
      done: topic.done,
    })),
  }));
}

function move(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const editChapter = (tree, index, change) =>
  tree.map((chapter, i) => (i === index ? { ...chapter, ...change(chapter) } : chapter));

const editTopic = (tree, chapterIndex, topicIndex, change) =>
  editChapter(tree, chapterIndex, (chapter) => ({
    topics: chapter.topics.map((topic, i) =>
      i === topicIndex ? { ...topic, ...change(topic) } : topic
    ),
  }));

export const renameChapter = (tree, index, title) => editChapter(tree, index, () => ({ title }));

export const renameTopic = (tree, chapterIndex, topicIndex, title) =>
  editTopic(tree, chapterIndex, topicIndex, () => ({ title }));

export const toggleDone = (tree, chapterIndex, topicIndex) =>
  editTopic(tree, chapterIndex, topicIndex, (topic) => ({ done: !topic.done }));

export const moveChapter = (tree, index, direction) => move(tree, index, direction);

export function moveTopic(tree, chapterIndex, topicIndex, direction) {
  const topics = tree[chapterIndex].topics;
  const moved = move(topics, topicIndex, direction);
  return moved === topics ? tree : editChapter(tree, chapterIndex, () => ({ topics: moved }));
}

export const removeChapter = (tree, index) => tree.filter((_, i) => i !== index);

export const removeTopic = (tree, chapterIndex, topicIndex) =>
  editChapter(tree, chapterIndex, (chapter) => ({
    topics: chapter.topics.filter((_, i) => i !== topicIndex),
  }));

export const addChapter = (tree) => [...tree, { key: newKey(), title: '', topics: [] }];

export const addTopic = (tree, chapterIndex) =>
  editChapter(tree, chapterIndex, (chapter) => ({
    topics: [...chapter.topics, { key: newKey(), title: '', done: false }],
  }));

/** What PUT /student/syllabus/{subject} takes: ids kept, blank rows dropped. */
export function toPayload(tree) {
  return tree
    .map((chapter) => ({ ...chapter, title: chapter.title.trim() }))
    .filter((chapter) => chapter.title)
    .map((chapter) => ({
      ...(chapter.id ? { id: chapter.id } : {}),
      title: chapter.title,
      topics: chapter.topics
        .map((topic) => ({ ...topic, title: topic.title.trim() }))
        .filter((topic) => topic.title)
        .map((topic) => ({
          ...(topic.id ? { id: topic.id } : {}),
          title: topic.title,
          done: topic.done,
        })),
    }));
}
