const NETWORK_MESSAGE = 'Unable to reach the server. Check your connection and try again.';
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Normalize an axios error from the `{ success, message, data }` envelope into
 * `{ status, message, fieldErrors, retryAfter }`.
 */
export function getApiError(error) {
  const response = error?.response;
  const status = response?.status ?? null;
  const body = response?.data;

  let message = typeof body?.message === 'string' ? body.message : null;
  if (!message) message = status ? GENERIC_MESSAGE : NETWORK_MESSAGE;

  const fieldErrors = {};
  for (const item of body?.data?.errors ?? []) {
    if (item?.field && !fieldErrors[item.field]) fieldErrors[item.field] = item.message;
  }

  const retryAfter = Number(response?.headers?.['retry-after']) || null;
  if (status === 429 && retryAfter) {
    message = `Too many attempts. Try again in ${formatWait(retryAfter)}.`;
  }

  return { status, message, fieldErrors, retryAfter };
}

/**
 * Push server field errors into react-hook-form. `fieldMap` maps API field
 * names to form field names when they differ. Returns true if any were applied.
 */
export function applyFieldErrors(fieldErrors, setError, fieldMap = {}) {
  let applied = false;
  for (const [apiField, message] of Object.entries(fieldErrors)) {
    const formField = fieldMap[apiField] ?? apiField;
    setError(formField, { type: 'server', message });
    applied = true;
  }
  return applied;
}

function formatWait(seconds) {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
