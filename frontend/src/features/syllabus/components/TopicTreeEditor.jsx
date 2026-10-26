import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Alert, Button, Card, CardContent, Checkbox, Input } from '@/components/ui';

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
} from '../treeEditing';

const MAX_TITLE = 120;
const UNNAMED = 'Give every chapter a name before saving. A chapter without one would be lost.';

function MoveButtons({ name, first, last, onMove }) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onMove(-1)}
        disabled={first}
        aria-label={`Move ${name} up`}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onMove(1)}
        disabled={last}
        aria-label={`Move ${name} down`}
      >
        <ArrowDown className="size-4" aria-hidden="true" />
      </Button>
    </>
  );
}

/**
 * Edit a subject's chapters and topics: rename, reorder, add, delete and tick off what's
 * done. `renderTopic(topic)` adds something under a saved topic (its pages).
 */
export function TopicTreeEditor({ chapters, onSave, saving = false, renderTopic }) {
  const [tree, setTree] = useState(() =>
    chapters.length ? fromServer(chapters) : addChapter([])
  );
  const [problem, setProblem] = useState(null);
  const save = (confirm) => {
    // A blank chapter is dropped on save, and its topics with it: never do that silently.
    const unnamed = tree.some(
      (chapter) => !chapter.title.trim() && chapter.topics.some((topic) => topic.title.trim())
    );
    setProblem(unnamed ? UNNAMED : null);
    if (!unnamed) onSave({ chapters: toPayload(tree), confirm });
  };

  return (
    <div className="space-y-4">
      {tree.map((chapter, ci) => {
        const chapterName = chapter.title.trim() || `chapter ${ci + 1}`;
        return (
          <Card key={chapter.key}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-1.5">
                <Input
                  value={chapter.title}
                  onChange={(event) => setTree(renameChapter(tree, ci, event.target.value))}
                  placeholder="Chapter name"
                  maxLength={MAX_TITLE}
                  aria-label={`Chapter ${ci + 1} title`}
                  className="font-semibold"
                />
                <MoveButtons
                  name={chapterName}
                  first={ci === 0}
                  last={ci === tree.length - 1}
                  onMove={(direction) => setTree(moveChapter(tree, ci, direction))}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTree(removeChapter(tree, ci))}
                  aria-label={`Delete chapter ${chapterName}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>

              <ul className="space-y-2 border-l border-border pl-3 sm:pl-5">
                {chapter.topics.map((topic, ti) => {
                  const topicName = topic.title.trim() || `topic ${ti + 1}`;
                  return (
                    <li key={topic.key} className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          checked={topic.done}
                          onChange={() => setTree(toggleDone(tree, ci, ti))}
                          aria-label={`Done: ${topicName}`}
                        />
                        <Input
                          value={topic.title}
                          onChange={(event) =>
                            setTree(renameTopic(tree, ci, ti, event.target.value))
                          }
                          placeholder="Topic"
                          maxLength={MAX_TITLE}
                          aria-label={`Topic ${ti + 1} of chapter ${ci + 1}`}
                          className={topic.done ? 'text-muted-foreground line-through' : ''}
                        />
                        <MoveButtons
                          name={topicName}
                          first={ti === 0}
                          last={ti === chapter.topics.length - 1}
                          onMove={(direction) => setTree(moveTopic(tree, ci, ti, direction))}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setTree(removeTopic(tree, ci, ti))}
                          aria-label={`Delete topic ${topicName}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                      {topic.id && renderTopic?.(topic)}
                    </li>
                  );
                })}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTree(addTopic(tree, ci))}
                aria-label={`Add topic to ${chapterName}`}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add topic
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {problem && <Alert variant="destructive">{problem}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setTree(addChapter(tree))}>
          <Plus className="size-4" aria-hidden="true" />
          Add chapter
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => save(false)} loading={saving}>
            Save
          </Button>
          <Button onClick={() => save(true)} loading={saving}>
            Confirm syllabus
          </Button>
        </div>
      </div>
    </div>
  );
}
