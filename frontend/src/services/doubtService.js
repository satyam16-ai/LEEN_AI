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

function postDoubt(body, signal) {
  return fetch(`${apiClient.defaults.baseURL}/student/doubts`, {
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
  async stream(body, { signal, onEvent }) {
    let response = await postDoubt(body, signal);
    if (response.status === 401) {
      try {
        await refreshSession();
      } catch (error) {
        notifySessionExpired();
        throw new Error('Your session has expired. Please sign in again.', { cause: error });
      }
      response = await postDoubt(body, signal);
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
  },
};
