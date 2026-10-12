// Keeps tabs in sync: signing in or out in one tab updates the others.
const CHANNEL_NAME = 'leen-auth';

const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;

export function broadcastAuthEvent(type) {
  channel?.postMessage({ type });
}

export function subscribeToAuthEvents(handler) {
  if (!channel) return () => {};
  const listener = (event) => handler(event.data?.type);
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
