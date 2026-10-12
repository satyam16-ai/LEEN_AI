import { AxiosError } from 'axios';

import { apiClient, setSessionExpiredHandler } from './api';

const originalAdapter = apiClient.defaults.adapter;

function respond(config, status, data = {}, delay = 0) {
  const response = { data, status, statusText: String(status), headers: {}, config };
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (status < 400) resolve(response);
      else reject(new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response));
    }, delay);
  });
}

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  setSessionExpiredHandler(() => {});
});

it('sends the CSRF header and credentials', async () => {
  let seen;
  apiClient.defaults.adapter = (config) => {
    seen = config;
    return respond(config, 200);
  };

  await apiClient.post('/anything');

  expect(seen.headers['X-Requested-With']).toBe('XMLHttpRequest');
  expect(seen.withCredentials).toBe(true);
});

it('shares one refresh between concurrent 401s and retries each request', async () => {
  const calls = [];
  let refreshed = false;
  apiClient.defaults.adapter = (config) => {
    calls.push(config.url);
    if (config.url === '/auth/refresh') {
      refreshed = true;
      return respond(config, 200, { success: true }, 10);
    }
    return refreshed ? respond(config, 200, { data: config.url }) : respond(config, 401);
  };

  const [first, second] = await Promise.all([apiClient.get('/one'), apiClient.get('/two')]);

  expect(calls.filter((url) => url === '/auth/refresh')).toHaveLength(1);
  expect(first.data.data).toBe('/one');
  expect(second.data.data).toBe('/two');
});

it('reports an expired session when the refresh fails', async () => {
  const onExpired = vi.fn();
  setSessionExpiredHandler(onExpired);
  apiClient.defaults.adapter = (config) => respond(config, 401);

  await expect(apiClient.get('/protected')).rejects.toMatchObject({ response: { status: 401 } });
  expect(onExpired).toHaveBeenCalledTimes(1);
});

it('never refreshes for auth endpoints such as login', async () => {
  const calls = [];
  apiClient.defaults.adapter = (config) => {
    calls.push(config.url);
    return respond(config, 401);
  };

  await expect(apiClient.post('/auth/login', {})).rejects.toBeTruthy();
  expect(calls).toEqual(['/auth/login']);
});
