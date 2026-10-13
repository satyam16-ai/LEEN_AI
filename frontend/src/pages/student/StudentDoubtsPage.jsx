import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageHeader } from '@/components/dashboard';
import { Alert, Button } from '@/components/ui';
import { useProfile } from '@/features/profile';
import {
  boardStatus,
  DoubtComposer,
  DoubtHistory,
  DoubtSuggestions,
  MathText,
  StepsList,
  useBoardPlayer,
  useDoubt,
  useDoubtSession,
  Whiteboard,
} from '@/features/whiteboard';

export function StudentDoubtsPage() {
  const { doubtId } = useParams();
  const navigate = useNavigate();
  const [player, board] = useBoardPlayer();
  const profile = useProfile();
  // The doubt explained live in this visit ('pending' until the server assigns an id).
  // Its URL shows the live board; any other doubt URL replays the saved board.
  const [liveId, setLiveId] = useState(null);
  const [seenDoubtId, setSeenDoubtId] = useState(doubtId);
  if (doubtId !== seenDoubtId) {
    setSeenDoubtId(doubtId);
    if (doubtId && liveId && liveId !== 'pending' && doubtId !== liveId) setLiveId(null);
  }

  const { session, ask, stop, reset } = useDoubtSession(player, {
    onDoubt: (doubt) => {
      setLiveId(doubt.id);
      navigate(`/student/doubts/${doubt.id}`, { replace: true });
    },
  });

  const live = liveId !== null || !doubtId;
  const replayId = live ? null : doubtId;
  const saved = useDoubt(replayId);

  // Opening a saved doubt stops any live explanation.
  useEffect(() => {
    if (!live) stop();
  }, [live, stop]);

  useEffect(() => {
    if (saved.data && saved.data.id === replayId) player.load(saved.data.actions);
  }, [saved.data, replayId, player]);

  const busy = live && (session.phase === 'connecting' || session.phase === 'streaming');
  const question = live ? session.question : saved.data?.question;

  const handleAsk = (values) => {
    setLiveId('pending');
    if (doubtId) navigate('/student/doubts');
    ask(values);
  };

  const startOver = () => {
    setLiveId(null);
    reset();
    player.load([]);
    navigate('/student/doubts');
  };

  const onDeleted = (id) => {
    if (id === doubtId) startOver();
  };

  const error = live
    ? session.phase === 'error' && session.error
    : saved.isError
      ? "Couldn't load this doubt. It may have been deleted."
      : saved.data?.status === 'failed' && saved.data.error;

  return (
    <>
      <PageHeader
        title="Ask a doubt"
        description="Your AI teacher explains it on the whiteboard, step by step."
        className="mb-6"
        actions={
          (doubtId || session.phase !== 'idle') && (
            <Button variant="outline" onClick={startOver}>
              <Plus className="size-4" aria-hidden="true" />
              New doubt
            </Button>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <DoubtComposer
            subjects={profile.data?.student_profile?.subjects ?? []}
            busy={busy}
            onAsk={handleAsk}
            onStop={stop}
          />

          {question && (
            <h2 className="line-clamp-2 pt-1 text-base font-semibold break-words sm:text-lg">
              <span className="text-muted-foreground">Q.</span> <MathText text={question} />
            </h2>
          )}

          {error && (
            <Alert
              variant={live ? 'destructive' : 'warning'}
              title={live ? 'Explanation interrupted' : 'Incomplete explanation'}
            >
              {error}
              {live && session.question && (
                <Button
                  variant="link"
                  className="ml-1 text-sm"
                  onClick={() =>
                    handleAsk({ question: session.question, subject: session.subject })
                  }
                >
                  Try again
                </Button>
              )}
            </Alert>
          )}

          <Whiteboard
            player={player}
            board={board}
            label={question}
            status={boardStatus(live ? session.phase : 'saved', board.status)}
            canReplay={!busy && (board.status === 'finished' || board.status === 'paused')}
          >
            <DoubtSuggestions onPick={(text) => handleAsk({ question: text, subject: null })} />
          </Whiteboard>
        </div>

        <aside className="space-y-6">
          <StepsList captions={board.captions} />
          <DoubtHistory activeId={doubtId} onDeleted={onDeleted} />
        </aside>
      </div>
    </>
  );
}
