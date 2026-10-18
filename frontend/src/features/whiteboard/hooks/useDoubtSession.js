import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { doubtService } from '@/services/doubtService';

import { DOUBT_KEYS } from './useDoubts';

const IDLE = { phase: 'idle', question: null, doubt: null, error: null, turns: 0 };
const CUT_OFF = 'The connection closed before the explanation finished. Please try again.';

/**
 * Streams a live explanation into `player`, and follow-up turns onto the same board.
 * phase: idle -> connecting -> streaming -> done | error | stopped
 * turns: board turns streamed in this visit (the first ask counts as one).
 */
export function useDoubtSession(player, { onDoubt } = {}) {
  const queryClient = useQueryClient();
  const controllerRef = useRef(null);
  const onDoubtRef = useRef(onDoubt);
  const [session, setSession] = useState(IDLE);

  useEffect(() => {
    onDoubtRef.current = onDoubt;
  });

  /** Stream one board turn; `start` opens the server stream with the event handler. */
  const run = useCallback(
    async (start, { onDoubtEvent } = {}) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      let outcome = null;
      let doubtId = null;
      try {
        await start({
          signal: controller.signal,
          onEvent: (event, data) => {
            if (event === 'doubt') {
              doubtId = data.id;
              setSession((current) => ({ ...current, phase: 'streaming', doubt: data }));
              onDoubtEvent?.(data);
            } else if (event === 'action') {
              player.enqueue(data);
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
        if (controllerRef.current === controller) {
          controllerRef.current = null;
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
    },
    [player, queryClient]
  );

  const ask = useCallback(
    ({ question, subject }) => {
      player.begin();
      setSession({ ...IDLE, phase: 'connecting', question, subject, turns: 1 });
      return run(
        (options) => doubtService.stream({ question, subject: subject || null }, options),
        { onDoubtEvent: (data) => onDoubtRef.current?.(data) }
      );
    },
    [player, run]
  );

  /** A follow-up ({question}) or "explain another way" ({mode}) on the same board. */
  const followUp = useCallback(
    (doubtId, { question = null, mode = 'follow_up', title = null }) => {
      player.extend();
      setSession((current) => ({
        ...current,
        phase: 'connecting',
        error: null,
        question: current.question ?? title,
        turns: current.turns + 1,
      }));
      return run((options) =>
        doubtService.streamTurn(doubtId, mode === 'follow_up' ? { question } : { mode }, options)
      );
    },
    [player, run]
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const reset = useCallback(() => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
    setSession(IDLE);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { session, ask, followUp, stop, reset };
}
