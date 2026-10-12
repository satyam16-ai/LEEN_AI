import { ROLE_HOME, SHARED_PATHS } from '@/features/auth/constants';

/** Only same-app relative paths are allowed, which blocks open redirects. */
export function safeNext(next) {
  if (typeof next !== 'string') return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}

function isUnder(path, base) {
  const pathname = path.split(/[?#]/)[0];
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function canAccessPath(role, path) {
  const home = ROLE_HOME[role];
  if (!home) return false;
  return isUnder(path, home) || SHARED_PATHS.some((base) => isUnder(path, base));
}

export function resolvePostLoginPath(user, next) {
  const safe = safeNext(next);
  if (safe && canAccessPath(user.role, safe)) return safe;
  return ROLE_HOME[user.role] ?? '/';
}
