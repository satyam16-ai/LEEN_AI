import { getApiError } from '@/utils/apiError';
import { createSSEParser } from '@/utils/sse';

import { apiClient, notifySessionExpired, refreshSession, unwrap } from './api';

const GENERIC = 'Something went wrong. Please try again.';

async function errorMessage(response) {
  try {
    const body = await response.json();
    if (response.status === 422) {
      return body?.data?.errors?.[0]?.message ?? 'Check your question and try again.';
    }
    if (typeof body?.message === 'string') return body.message;
  } catch {
    /* not JSON */
  }
  return GENERIC;
}

function post(path, body, signal) {
  return fetch(`${apiClient.defaults.baseURL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(body),
    signal,
  });
}

export const doubtService = {
  list: () => apiClient.get('/student/doubts').then(unwrap),
  get: (doubtId) => apiClient.get(`/student/doubts/${doubtId}`).then(unwrap),
  remove: (doubtId) =>
    apiClient.delete(`/student/doubts/${doubtId}`).then((res) => res.data.message),

  /**
   * Ask a doubt and stream the whiteboard explanation. Calls `onEvent(name, data)`
   * for each server-sent event (doubt, status, action, done, error). Resolves when
   * the stream ends; rejects on HTTP errors, network errors or abort.
   */
  stream: (body, options) => streamSSE('/student/doubts', body, options),

  /**
   * Stream another turn onto a doubt's board: a follow-up ({question}), a reply mid-explanation
   * ({question, keep}), another way ({mode}), a check ({mode: 'check', ask, keep}) or practice.
   */
  streamTurn: (doubtId, body, options) =>
    streamSSE(`/student/doubts/${doubtId}/turns`, body, options),

  /** Check an answer to a question on the board; rejects with the server's message. */
  answer: async (doubtId, body) => {
    try {
      return await apiClient.post(`/student/doubts/${doubtId}/answers`, body).then(unwrap);
    } catch (error) {
      throw new Error(getApiError(error).message, { cause: error });
    }
  },
};

async function streamSSE(path, body, { signal, onEvent }) {
  let response = await post(path, body, signal);
  if (response.status === 401) {
    try {
      await refreshSession();
    } catch (error) {
      notifySessionExpired();
      throw new Error('Your session has expired. Please sign in again.', { cause: error });
    }
    response = await post(path, body, signal);
  }
  if (!response.ok || !response.body) throw new Error(await errorMessage(response));

  const parser = createSSEParser(onEvent);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.feed(value);
  }
  parser.end();
}
