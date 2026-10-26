import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { doubtService } from '@/services/doubtService';

import { DOUBT_KEYS } from './useDoubts';

const IDLE = {
  phase: 'idle',
  question: null,
  doubt: null,
  error: null,
  turns: 0,
  // A message the student sent while the AI was still writing; it goes out when that ends.
  pending: null,
  // A queued message whose turn failed: the talk bar puts it back in the box.
  unsent: null,
  // An answer is being checked.
  checking: false,
  // How the last answer went: { kind: correct | wrong | final | teacher | marked | unreadable }.
  feedback: null,
};
const CUT_OFF = 'The connection closed before the explanation finished. Please try again.';
const PHOTO_TITLE = 'Question from a photo';
const MAX_MESSAGE = 500;
const CORRECT = 'Correct! Well done.';
const TRY_AGAIN = 'Not quite. Have another go.';
// Player states in which the board is still explaining: a message waits for the step to end.
const MIDWAY = new Set(['playing', 'paused', 'asking']);

/**
 * Streams a live explanation into `player`, and more turns onto the same board.
 * phase: idle -> connecting -> streaming -> done | error | stopped
 * turns: board turns streamed in this visit (the first ask counts as one).
 *
 * The student can talk at any time without cutting the AI off: say() waits until the
 * AI has finished writing the turn, then cuts the board at the end of the step being
 * drawn and asks for a reply that carries on from there.
 */
export function useDoubtSession(player, { onDoubt } = {}) {
  const queryClient = useQueryClient();
  const controllerRef = useRef(null);
  const onDoubtRef = useRef(onDoubt);
  const doubtIdRef = useRef(null);
  const generatingRef = useRef(false);
  const pendingRef = useRef(null);
  // An answer given while the AI was still writing: its question isn't saved until then.
  const pendingAnswerRef = useRef(null);
  const sendRef = useRef(null);
  const answerRef = useRef(null);
  const [session, setSession] = useState(IDLE);

  useEffect(() => {
    onDoubtRef.current = onDoubt;
  });

  /** Stream one board turn; `start` opens the server stream with the event handler. */
  const run = useCallback(
    async (start, { onDoubtEvent, onRefused } = {}) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      generatingRef.current = true;

      let outcome = null;
      let doubtId = null;
      let opened = false;
      try {
        await start({
          signal: controller.signal,
          onEvent: (event, data) => {
            if (event === 'doubt') {
              opened = true;
              doubtId = data.id;
              doubtIdRef.current = data.id;
              setSession((current) => ({ ...current, phase: 'streaming', doubt: data }));
              onDoubtEvent?.(data);
            } else if (event === 'action') {
              player.enqueue(data);
              if (data?.type === 'verdict') {
                const feedback = { kind: data.correct ? 'correct' : 'marked' };
                setSession((current) => ({ ...current, feedback }));
              }
            } else if (event === 'done') {
              outcome = { phase: 'done' };
            } else if (event === 'error') {
              outcome = { phase: 'error', error: data?.message ?? CUT_OFF };
            }
          },
        });
        outcome ??= { phase: 'error', error: CUT_OFF };
      } catch (error) {
        outcome = controller.signal.aborted
          ? { phase: 'stopped' }
          : { phase: 'error', error: error.message || CUT_OFF };
      } finally {
        // Refused before it started (422, 429, 409): nothing reached the board.
        if (!opened && outcome.phase === 'error') onRefused?.();
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          generatingRef.current = false;
          player.endStream();
          setSession((current) => ({ ...current, ...outcome }));
        }
        const refresh = () => {
          queryClient.invalidateQueries({ queryKey: DOUBT_KEYS.all, exact: true });
          if (doubtId) queryClient.invalidateQueries({ queryKey: DOUBT_KEYS.detail(doubtId) });
        };
        if (outcome.phase === 'stopped' && doubtId) {
          // The server saves a stopped doubt once it notices the disconnect, a moment later.
          queryClient.setQueryData(DOUBT_KEYS.all, (doubts) =>
            doubts?.map((doubt) => (doubt.id === doubtId ? { ...doubt, status: 'failed' } : doubt))
          );
          setTimeout(refresh, 2000);
        } else {
          refresh();
        }
      }
      if (controllerRef.current !== null) return;
      // An answer given while the AI was writing is checked now that its question is saved.
      const answered = pendingAnswerRef.current;
      if (answered !== null) {
        pendingAnswerRef.current = null;
        if (outcome.phase === 'done') await answerRef.current?.(answered);
        else setSession((current) => ({ ...current, checking: false }));
      }
      // A message sent while the AI was writing goes out now that it has finished.
      const waiting = pendingRef.current;
      if (waiting !== null && controllerRef.current === null) {
        pendingRef.current = null;
        const done = outcome.phase === 'done';
        setSession((current) => ({ ...current, pending: null, unsent: done ? null : waiting }));
        if (done) await sendRef.current?.(waiting);
      }
    },
    [player, queryClient]
  );

  const ask = useCallback(
    ({ question, subject, photo = null }) => {
      player.begin();
      doubtIdRef.current = null;
      pendingRef.current = null;
      setSession({
        ...IDLE,
        phase: 'connecting',
        question: question || (photo ? PHOTO_TITLE : question),
        subject,
        // What was asked, so "Try again" can send it (photo included) once more.
        retry: { question, subject, photo },
        turns: 1,
      });
      const body = { question, subject: subject || null };
      return run(
        (options) =>
          photo
            ? doubtService.streamPhoto({ ...body, photo }, options)
            : doubtService.stream(body, options),
        { onDoubtEvent: (data) => onDoubtRef.current?.(data) }
      );
    },
    [player, run]
  );

  /** Stream `body` as the next turn on board `doubtId`. */
  const streamTurn = useCallback(
    (doubtId, body, title = null, { onRefused } = {}) => {
      doubtIdRef.current = doubtId;
      player.extend();
      setSession((current) => ({
        ...current,
        phase: 'connecting',
        error: null,
        question: current.question ?? title,
        turns: current.turns + 1,
      }));
      return run((options) => doubtService.streamTurn(doubtId, body, options), { onRefused });
    },
    [player, run]
  );

  /** A follow-up ({question}) or "explain another way" ({mode}) on board `doubtId`. */
  const followUp = useCallback(
    (doubtId, { question = null, mode = 'follow_up', title = null }) =>
      streamTurn(doubtId, mode === 'follow_up' ? { question } : { mode }, title),
    [streamTurn]
  );

  /** Something the student said or typed: answered after the step being drawn. */
  const send = useCallback(
    (text) => {
      const doubtId = doubtIdRef.current;
      if (!doubtId) return undefined;
      const { status } = player.getSnapshot();
      // Finished, or still playing an earlier turn (a replay): the reply comes after it all.
      const earlier = player.next < player.turnOffset;
      if (!MIDWAY.has(status) || earlier) return streamTurn(doubtId, { question: text });
      if (status === 'asking') player.skipAsk();
      const at = player.stepEnd();
      const keep = player.keepCount(at);
      const removed = player.cut(at);
      return streamTurn(doubtId, { question: text, keep }, null, {
        onRefused: () => player.restore?.(removed),
      });
    },
    [player, streamTurn]
  );

  useEffect(() => {
    sendRef.current = send;
  });

  const say = useCallback(
    (text) => {
      if (!doubtIdRef.current && !generatingRef.current) return undefined;
      setSession((current) => (current.unsent ? { ...current, unsent: null } : current));
      if (generatingRef.current) {
        // Several messages while the AI writes are all kept, as one.
        const queued = pendingRef.current ? `${pendingRef.current}\n${text}` : text;
        pendingRef.current = queued.slice(0, MAX_MESSAGE);
        setSession((current) => ({ ...current, pending: pendingRef.current }));
        return undefined;
      }
      return send(text);
    },
    [send]
  );

  /** Ask the Examiner to explain the answer to question `askId`, cutting the board at `at`. */
  const check = useCallback(
    async (askId, at) => {
      player.cut(at);
      const body = { mode: 'check', ask: askId, keep: player.keepCount(at) };
      await streamTurn(doubtIdRef.current, body);
      // The check is over: "Your teacher is checking…" shouldn't outlive it.
      setSession((current) =>
        current.feedback?.kind === 'teacher' ? { ...current, feedback: null } : current
      );
    },
    [player, streamTurn]
  );

  /** The student's answer to the open question: checked on the server, written on the board. */
  const answer = useCallback(
    async (value) => {
      const doubtId = doubtIdRef.current;
      const { ask: question } = player.getSnapshot();
      if (!question || (!doubtId && !generatingRef.current)) return;
      setSession((current) => ({ ...current, checking: true, feedback: null }));
      if (generatingRef.current) {
        pendingAnswerRef.current = value;
        return;
      }
      let result;
      try {
        result = await doubtService.answer(doubtId, { ask: question.id, answer: value });
      } catch (error) {
        setSession((current) => ({
          ...current,
          checking: false,
          feedback: { kind: 'unreadable', message: error.message },
        }));
        return;
      }
      const { correct, final, expected } = result;
      const release = correct === true || final;
      const after = player.answerAsk({
        text: value,
        correct,
        say: correct === true ? CORRECT : correct === false && !final ? TRY_AGAIN : null,
        release,
      });
      const kind =
        correct === true ? 'correct' : correct === null ? 'teacher' : final ? 'final' : 'wrong';
      setSession((current) => ({ ...current, checking: false, feedback: { kind, expected } }));
      // Out of tries, or a written answer: the Examiner explains it on the board.
      if (release && correct !== true) await check(question.id, after);
    },
    [player, check]
  );

  useEffect(() => {
    answerRef.current = answer;
  });

  /** Move on without answering; if nothing follows the question, the AI shows the solution. */
  const skip = useCallback(() => {
    const { ask: question } = player.getSnapshot();
    if (!question) return undefined;
    player.skipAsk();
    const nothingAfter = player.next >= player.actions.length;
    if (nothingAfter && !generatingRef.current && doubtIdRef.current) {
      return check(question.id, player.next);
    }
    return undefined;
  }, [player, check]);

  /** "Now you try": a practice question like the doubt. */
  const tryOne = useCallback(() => {
    if (!doubtIdRef.current) return undefined;
    setSession((current) => ({ ...current, feedback: null }));
    return streamTurn(doubtIdRef.current, { mode: 'practice' });
  }, [streamTurn]);

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const reset = useCallback(() => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    generatingRef.current = false;
    pendingRef.current = null;
    pendingAnswerRef.current = null;
    doubtIdRef.current = null;
    controller?.abort();
    setSession(IDLE);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { session, ask, followUp, say, answer, skip, tryOne, stop, reset };
}
