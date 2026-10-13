import axios from 'axios';

// Auth endpoints that must never trigger a refresh-and-retry on 401.
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

/**
 * Tokens live in HttpOnly cookies, so the client never touches them. The custom
 * header satisfies the backend's CSRF check for state-changing requests.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

let refreshPromise = null;
let sessionExpiredHandler = () => {};

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

/** For requests made outside axios (e.g. streaming fetch) whose refresh failed. */
export function notifySessionExpired() {
  sessionExpiredHandler();
}

/** Single-flight: concurrent 401s share one refresh request. */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = apiClient.post('/auth/refresh').finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const skip =
      !config || config._retry || NO_REFRESH_PATHS.some((path) => config.url?.startsWith(path));
    if (response?.status !== 401 || skip) {
      return Promise.reject(error);
    }

    config._retry = true;
    try {
      await refreshSession();
    } catch {
      sessionExpiredHandler();
      return Promise.reject(error);
    }
    return apiClient(config);
  }
);

export const unwrap = (response) => response.data.data;
